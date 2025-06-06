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

// --- NEW: Resilient fetch function with retry logic ---
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 300): Promise<Response> {
    try {
        const response = await fetch(url, options);

        if (response.status === 429 && retries > 0) {
            const retryAfterHeader = response.headers.get('Retry-After');
            // Spotify's header gives seconds. Default to our backoff if header is missing.
            const wait = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : backoff;
            
            console.warn(`Spotify API rate limited. Retrying after ${wait}ms... (Retries left: ${retries})`);
            await delay(wait);
            
            // Try again with one less retry attempt and increase the backoff for the next potential failure.
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }

        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`Fetch failed (network error). Retrying after ${backoff}ms... (Retries left: ${retries})`, error);
            await delay(backoff);
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        // If all retries fail, throw the error to be caught by the main handler.
        throw error;
    }
}


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
        const firstResponse = await fetchWithRetry(firstUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!firstResponse.ok) throw new Error("Failed to fetch initial liked songs after retries");
        
        const firstPage: SpotifySavedTracksResponse = await firstResponse.json();
        const totalTracks = firstPage.total;
        let allTracks = firstPage.items;

        if (totalTracks > limit) {
            const fetchFunctions: (() => Promise<Response>)[] = [];
            for (let offset = limit; offset < totalTracks; offset += limit) {
                const url = `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}&fields=${fields}`;
                fetchFunctions.push(() => fetchWithRetry(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
            }

            const batchSize = 10;
            const delayBetweenBatches = 50; // A small delay as a courtesy between batches

            for (let i = 0; i < fetchFunctions.length; i += batchSize) {
                const batch = fetchFunctions.slice(i, i + batchSize);
                const batchPromises = batch.map(func => func());
                
                const responses = await Promise.all(batchPromises);

                const additionalPages = await Promise.all(
                    responses.map(res => {
                        if (res && res.ok) {
                            return res.json() as Promise<SpotifySavedTracksResponse>;
                        }
                        console.error(`A request in a batch failed permanently and will be skipped.`);
                        return null;
                    })
                );

                additionalPages.forEach(page => {
                    if (page?.items) allTracks = allTracks.concat(page.items);
                });
                
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
