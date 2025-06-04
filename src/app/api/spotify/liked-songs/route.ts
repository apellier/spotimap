// src/app/api/spotify/liked-songs/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions"; // Or the correct path
import { NextResponse } from "next/server";

// Define types for the Spotify API response (simplified)
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
}

interface SpotifySavedTrackItem {
    added_at: string;
    track: SpotifyTrack;
}

interface SpotifySavedTracksResponse {
    href: string;
    items: SpotifySavedTrackItem[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}


export async function GET() {
    // 1. Get the session and access token
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = session.accessToken;
    let allTracks: SpotifySavedTrackItem[] = [];
    let nextUrl: string | null = `https://api.spotify.com/v1/me/tracks?limit=50`

    try {
        // 2. Fetch liked songs, handling pagination
        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Spotify API Error:", errorData);
                return NextResponse.json(
                    { error: "Failed to fetch liked songs from Spotify", details: errorData },
                    { status: response.status }
                );
            }

            const data = (await response.json()) as SpotifySavedTracksResponse;
            allTracks = allTracks.concat(data.items);
            nextUrl = data.next; // Get the URL for the next page of results
        }

        // 3. Optionally, transform the data before sending it back
        // For now, we'll send the raw track items
        // In the future, we might just extract artist names and countries here.

        return NextResponse.json({ tracks: allTracks, total: allTracks.length });

    } catch (error) {
        console.error("Error fetching liked songs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}