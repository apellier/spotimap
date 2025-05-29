// src/app/api/spotify/playlists/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route"; // Your reusable authOptions
import { NextResponse } from "next/server";

// Simplified types for Spotify Playlist objects
interface SpotifyPlaylistOwner {
    display_name: string;
    id: string;
}

interface SpotifyPlaylistImage {
    url: string;
    height: number | null;
    width: number | null;
}

interface SpotifyPlaylistTracksInfo {
    href: string;
    total: number;
}

interface SpotifyPlaylistItem {
    id: string;
    name: string;
    description: string;
    owner: SpotifyPlaylistOwner;
    images: SpotifyPlaylistImage[];
    tracks: SpotifyPlaylistTracksInfo; // Provides total number of tracks and a link to fetch them
    public: boolean;
    collaborative: boolean;
    external_urls: { spotify: string };
}

interface SpotifyUserPlaylistsResponse {
    href: string;
    items: SpotifyPlaylistItem[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = session.accessToken;
    let allPlaylists: SpotifyPlaylistItem[] = [];
    // Max limit for playlists is 50 per request
    let nextUrl: string | null = `https://api.spotify.com/v1/me/playlists?limit=50`;

    try {
        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Spotify API Error (Playlists):", errorData);
                return NextResponse.json(
                    { error: "Failed to fetch playlists from Spotify", details: errorData },
                    { status: response.status }
                );
            }

            const data = (await response.json()) as SpotifyUserPlaylistsResponse;
            allPlaylists = allPlaylists.concat(data.items);
            nextUrl = data.next; // URL for the next page of results, or null if no more pages
        }

        return NextResponse.json({ playlists: allPlaylists, total: allPlaylists.length });

    } catch (error) {
        console.error("Error fetching playlists:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}