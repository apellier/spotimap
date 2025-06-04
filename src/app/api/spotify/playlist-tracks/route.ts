// src/app/api/spotify/playlist-tracks/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions"; // Or the correct path
import { NextRequest, NextResponse } from "next/server";

// Using the same track types as defined in liked-songs route for consistency
// Or you can define them again or import from a shared types file
interface SpotifyArtist {
    id: string;
    name: string;
    external_urls: { spotify: string };
}

interface SpotifyAlbumImage {
    url: string;
    height: number;
    width: number;
}

interface SpotifyAlbum {
    id: string;
    name: string;
    images: SpotifyAlbumImage[];
    external_urls: { spotify: string };
}

interface SpotifyTrack {
    id: string;
    name: string;
    uri: string;
    artists: SpotifyArtist[];
    album: SpotifyAlbum;
    external_urls: { spotify: string };
    preview_url: string | null;
    is_local: boolean; // Playlist tracks can be local files
}

// Structure for items within a playlist response (slightly different from saved tracks)
interface SpotifyPlaylistTrackItem {
    added_at: string;
    added_by: { id: string; type: string; uri: string; };
    is_local: boolean;
    track: SpotifyTrack | null; // Track can be null if unavailable (e.g., removed by Spotify)
}

interface SpotifyPlaylistTracksResponse {
    href: string;
    items: SpotifyPlaylistTrackItem[];
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

    // Get playlist_id from query parameters
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get("playlist_id");

    if (!playlistId) {
        return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 });
    }

    const accessToken = session.accessToken;
    let allPlaylistTracks: SpotifyPlaylistTrackItem[] = [];
    // Max limit for playlist tracks is 100 per request
    // We can also specify which fields to return using the `fields` parameter to optimize
    let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(added_at,added_by,is_local,track(id,name,uri,artists(id,name),album(id,name,images),external_urls,preview_url)),next,total`;


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
        // We map here to ensure consistent structure, especially because playlist items can have `track: null`
        const tracksForClient = allPlaylistTracks.map(item => ({
            added_at: item.added_at,
            track: item.track // `item.track` is already filtered to be non-null
        }));


        return NextResponse.json({ tracks: tracksForClient, total: tracksForClient.length });

    } catch (error) {
        console.error(`Error fetching tracks for playlist ${playlistId}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}