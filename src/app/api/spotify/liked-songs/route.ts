// src/app/api/spotify/liked-songs/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import { LikedSongItem } from "@/types"; // Import from the single source of truth

// Define the structure of the paginated API response from Spotify for liked songs
interface SpotifySavedTracksResponse {
    href: string;
    items: LikedSongItem[];
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
    let allTracks: LikedSongItem[] = [];
    
    // OPTIMIZED: Use the `fields` parameter to fetch only the necessary data
    let nextUrl: string | null = `https://api.spotify.com/v1/me/tracks?limit=50&fields=next,items(added_at,track(id,name,uri,artists(name)))`;

    try {
        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Spotify API Error (Liked Songs):", errorData);
                return NextResponse.json(
                    { error: "Failed to fetch liked songs from Spotify", details: errorData },
                    { status: response.status }
                );
            }

            const data = (await response.json()) as SpotifySavedTracksResponse;
            allTracks = allTracks.concat(data.items);
            nextUrl = data.next;
        }

        return NextResponse.json({ tracks: allTracks, total: allTracks.length });

    } catch (error) {
        console.error("Error fetching liked songs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
