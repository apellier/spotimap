// src/app/api/spotify/playlist-tracks/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextRequest, NextResponse } from "next/server";
import { PlaylistTrackItem } from "@/types";

interface SpotifyPlaylistTracksResponse {
    items: PlaylistTrackItem[];
    next: string | null;
    total: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 300): Promise<Response> {
    try {
        const response = await fetch(url, options);
        if (response.status === 429 && retries > 0) {
            const retryAfter = response.headers.get('Retry-After');
            const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoff;
            console.warn(`Rate limited. Retrying after ${wait}ms... (Retries left: ${retries})`);
            await delay(wait);
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`Fetch failed. Retrying after ${backoff}ms... (Retries left: ${retries})`, error);
            await delay(backoff);
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw error;
    }
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get("playlist_id");
    if (!playlistId) {
        return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 });
    }

    const accessToken = session.accessToken;
    const limit = 50;
    const fields = 'total,next,items(added_at,track(id,name,uri,artists(name)))';
    const firstUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&fields=${fields}`;

    try {
        const firstResponse = await fetchWithRetry(firstUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!firstResponse.ok) throw new Error(`Failed to fetch initial tracks for playlist ${playlistId}`);

        const firstPage: SpotifyPlaylistTracksResponse = await firstResponse.json();
        const totalTracks = firstPage.total;
        let allPlaylistTracks = firstPage.items.filter(item => item.track !== null);

        if (totalTracks > limit) {
            const fetchFunctions: (() => Promise<Response>)[] = [];
            for (let offset = limit; offset < totalTracks; offset += limit) {
                const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=${fields}`;
                fetchFunctions.push(() => fetchWithRetry(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
            }
            
            const batchSize = 10;
            const delayBetweenBatches = 50;

            for (let i = 0; i < fetchFunctions.length; i += batchSize) {
                const batch = fetchFunctions.slice(i, i + batchSize);
                const batchPromises = batch.map(func => func());
                
                const responses = await Promise.all(batchPromises);

                const additionalPages = await Promise.all(
                    responses.map(res => {
                        if (res && res.ok) {
                            return res.json() as Promise<SpotifyPlaylistTracksResponse>;
                        }
                        console.error(`A request in a batch failed permanently and will be skipped.`);
                        return null;
                    })
                );

                additionalPages.forEach(page => {
                    if (page?.items) {
                        const validItems = page.items.filter(item => item.track !== null);
                        allPlaylistTracks = allPlaylistTracks.concat(validItems);
                    }
                });

                if (i + batchSize < fetchFunctions.length) {
                    await delay(delayBetweenBatches);
                }
            }
        }
        
        return NextResponse.json({ tracks: allPlaylistTracks, total: allPlaylistTracks.length });

    } catch (error) {
        console.error(`Error fetching tracks for playlist ${playlistId}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
