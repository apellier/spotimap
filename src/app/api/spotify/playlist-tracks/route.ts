// src/app/api/spotify/playlist-tracks/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextRequest, NextResponse } from "next/server";
import { PlaylistTrackItem } from "@/types"; // Import from the single source of truth

// Define the structure of the paginated API response from Spotify for playlist tracks
interface SpotifyPlaylistTracksResponse {
    href: string;
    items: PlaylistTrackItem[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
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
    let allPlaylistTracks: PlaylistTrackItem[] = [];
    
    // OPTIMIZED: Use the `fields` parameter to fetch only the necessary data
    let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=next,items(added_at,track(id,name,uri,artists(name)))`;

    try {
        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Spotify API Error (Playlist Tracks for ${playlistId}):`, errorData);
                return NextResponse.json(
                    { error: `Failed to fetch tracks for playlist ${playlistId}`, details: errorData },
                    { status: response.status }
                );
            }

            const data = (await response.json()) as SpotifyPlaylistTracksResponse;
            // Filter out any items where track is null (can happen if a track is no longer available)
            const validItems = data.items.filter(item => item.track !== null);
            allPlaylistTracks = allPlaylistTracks.concat(validItems);
            nextUrl = data.next;
        }

        return NextResponse.json({ tracks: allPlaylistTracks, total: allPlaylistTracks.length });

    } catch (error) {
        console.error(`Error fetching tracks for playlist ${playlistId}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
