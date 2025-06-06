// src/app/api/spotify/playlists/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import { PlaylistItem } from "@/types";

interface SpotifyUserPlaylistsResponse {
    items: PlaylistItem[];
    next: string | null;
    total: number;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = session.accessToken;
    const limit = 50;
    const fields = 'total,next,items(id,name,tracks(total))';
    const firstUrl = `https://api.spotify.com/v1/me/playlists?limit=${limit}&fields=${fields}`;

    try {
        const firstResponse = await fetch(firstUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!firstResponse.ok) throw new Error("Failed to fetch initial playlists");
        
        const firstPage: SpotifyUserPlaylistsResponse = await firstResponse.json();
        const totalPlaylists = firstPage.total;
        let allPlaylists = firstPage.items;

        if (totalPlaylists > limit) {
            const fetchFunctions: (() => Promise<Response>)[] = [];
            for (let offset = limit; offset < totalPlaylists; offset += limit) {
                const url = `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}&fields=${fields}`;
                fetchFunctions.push(() => fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
            }
            
            const batchSize = 10;
            for (let i = 0; i < fetchFunctions.length; i += batchSize) {
                const batchPromises = fetchFunctions.slice(i, i + batchSize).map(func => func());
                const responses = await Promise.all(batchPromises);

                const additionalPages = await Promise.all(
                    responses.map(res => res.ok ? (res.json() as Promise<SpotifyUserPlaylistsResponse>) : null)
                );
                
                additionalPages.forEach(page => {
                    if (page?.items) allPlaylists = allPlaylists.concat(page.items);
                });
            }
        }
        
        return NextResponse.json({ playlists: allPlaylists, total: allPlaylists.length });

    } catch (error) {
        console.error("Error fetching playlists:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
