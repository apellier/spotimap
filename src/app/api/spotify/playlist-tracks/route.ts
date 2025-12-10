// src/app/api/spotify/playlist-tracks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PlaylistTrackItem } from "@/types";

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

interface SpotifyPlaylistTracksResponse {
    items: PlaylistTrackItem[];
    next: string | null;
    total: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Use Client Credentials flow (no user auth needed)
async function getClientCredentialsToken(): Promise<string> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Spotify credentials not configured");
    }

    const res = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        },
        body: 'grant_type=client_credentials',
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error("Failed to get Spotify access token");
    }

    const data = await res.json();
    return data.access_token;
}

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
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get("playlist_id");

    if (!playlistId) {
        return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 });
    }

    try {
        // Get app-level token (Client Credentials)
        const accessToken = await getClientCredentialsToken();

        const limit = 50;
        const fields = 'total,next,items(added_at,track(id,name,uri,artists(name)))';
        const firstUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&fields=${fields}`;

        const firstResponse = await fetchWithRetry(firstUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

        if (!firstResponse.ok) {
            if (firstResponse.status === 404) {
                return NextResponse.json({ error: "Playlist not found or is not public" }, { status: 404 });
            }
            throw new Error(`Failed to fetch tracks for playlist ${playlistId}`);
        }

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
