// src/app/api/spotify/playlists/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import { PlaylistItem } from "@/types"; // Import from the single source of truth

// Define the structure of the paginated API response from Spotify for playlists
interface SpotifyUserPlaylistsResponse {
    href: string;
    items: PlaylistItem[];
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
    let allPlaylists: PlaylistItem[] = [];
    
    // OPTIMIZED: Use the `fields` parameter to fetch only the necessary data
    let nextUrl: string | null = `https://api.spotify.com/v1/me/playlists?limit=50&fields=next,items(id,name,tracks(total))`;

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
            nextUrl = data.next;
        }

        return NextResponse.json({ playlists: allPlaylists, total: allPlaylists.length });

    } catch (error) {
        console.error("Error fetching playlists:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
