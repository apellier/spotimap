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
        const firstResponse = await fetch(firstUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!firstResponse.ok) throw new Error(`Failed to fetch initial tracks for playlist ${playlistId}`);

        const firstPage: SpotifyPlaylistTracksResponse = await firstResponse.json();
        const totalTracks = firstPage.total;
        let allPlaylistTracks = firstPage.items.filter(item => item.track !== null);

        if (totalTracks > limit) {
            const fetchFunctions: (() => Promise<Response>)[] = [];
            for (let offset = limit; offset < totalTracks; offset += limit) {
                const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=${fields}`;
                fetchFunctions.push(() => fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
            }
            
            const batchSize = 10;
            for (let i = 0; i < fetchFunctions.length; i += batchSize) {
                const batchPromises = fetchFunctions.slice(i, i + batchSize).map(func => func());
                const responses = await Promise.all(batchPromises);

                const additionalPages = await Promise.all(
                    responses.map(res => res.ok ? (res.json() as Promise<SpotifyPlaylistTracksResponse>) : null)
                );

                additionalPages.forEach(page => {
                    if (page?.items) {
                        const validItems = page.items.filter(item => item.track !== null);
                        allPlaylistTracks = allPlaylistTracks.concat(validItems);
                    }
                });
            }
        }
        
        return NextResponse.json({ tracks: allPlaylistTracks, total: allPlaylistTracks.length });

    } catch (error) {
        console.error(`Error fetching tracks for playlist ${playlistId}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
