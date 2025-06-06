// src/app/api/spotify/liked-songs/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import { LikedSongItem } from "@/types";

interface SpotifySavedTracksResponse {
    items: LikedSongItem[];
    next: string | null;
    total: number;
}

// Helper function to introduce a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = session.accessToken;
    const limit = 50;
    const fields = 'total,next,items(added_at,track(id,name,uri,artists(name)))';
    const firstUrl = `https://api.spotify.com/v1/me/tracks?limit=${limit}&fields=${fields}`;

    try {
        const firstResponse = await fetch(firstUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!firstResponse.ok) throw new Error("Failed to fetch initial liked songs");
        
        const firstPage: SpotifySavedTracksResponse = await firstResponse.json();
        const totalTracks = firstPage.total;
        let allTracks = firstPage.items;

        if (totalTracks > limit) {
            const fetchFunctions: (() => Promise<Response>)[] = [];
            for (let offset = limit; offset < totalTracks; offset += limit) {
                const url = `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}&fields=${fields}`;
                fetchFunctions.push(() => fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
            }

            // --- THROTTLED BATCHING LOGIC ---
            const batchSize = 10; // Process 10 requests at a time
            const delayBetweenBatches = 100; // ms to wait between each batch

            for (let i = 0; i < fetchFunctions.length; i += batchSize) {
                const batch = fetchFunctions.slice(i, i + batchSize);
                const batchPromises = batch.map(func => func());
                
                const responses = await Promise.all(batchPromises);

                const additionalPages = await Promise.all(
                    responses.map(res => {
                        if (!res.ok) {
                            console.error(`Spotify API Error (Liked Songs - Batch): Status ${res.status}`);
                            return null; // Gracefully handle failed requests, don't stop the whole process
                        }
                        return res.json() as Promise<SpotifySavedTracksResponse>;
                    })
                );

                additionalPages.forEach(page => {
                    if (page?.items) allTracks = allTracks.concat(page.items);
                });
                
                // Wait before processing the next batch to avoid hitting rate limits
                if (i + batchSize < fetchFunctions.length) {
                    await delay(delayBetweenBatches);
                }
            }
        }

        return NextResponse.json({ tracks: allTracks, total: allTracks.length });

    } catch (error) {
        console.error("Error fetching liked songs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
