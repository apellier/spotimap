
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma"; // Ensure this exists or I need to check where prisma client is exported

// Function to extract ID from Spotify URL
const extractSpotifyId = (url: string) => {
    // Matches /playlist/ID or spotify:playlist:ID
    const match = url.match(/playlist[:/]([a-zA-Z0-9]+)/);
    return match ? match[1] : url;
};

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const playlists = await prisma.savedPlaylist.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ playlists });
    } catch (error) {
        console.error("Error fetching playlists:", error);
        return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { spotifyUrl } = body;

        if (!spotifyUrl) {
            return NextResponse.json({ error: "No Spotify URL provided" }, { status: 400 });
        }

        const spotifyId = extractSpotifyId(spotifyUrl);

        // We should fetch playlist details from Spotify Public API to get name/image
        // Use client credentials flow or just the user's token (even if limited, playlist-read-private is user scope? NO, we only have public access).
        // Actually, since we only support public playlists, we can use the user's token to fetch it IF it is public, OR use client credentials.
        // For simplicity, let's try using the user session token first. If the playlist is public, it should work.

        const playlistMetadata = { name: `Playlist ${spotifyId}`, description: "", imageUrl: "" };

        if (session.accessToken) {
            try {
                const spRes = await fetch(`https://api.spotify.com/v1/playlists/${spotifyId}?fields=name,description,images`, {
                    headers: { Authorization: `Bearer ${session.accessToken}` }
                });
                if (spRes.ok) {
                    const spData = await spRes.json();
                    playlistMetadata.name = spData.name;
                    playlistMetadata.description = spData.description;
                    playlistMetadata.imageUrl = spData.images?.[0]?.url || "";
                }
            } catch (ignore) { }
        }

        // Ensure User exists in DB
        // upsert user
        await prisma.user.upsert({
            where: { spotifyId: session.user.id },
            update: {},
            create: {
                id: session.user.id, // Use the same ID if possible, or let CUID handle it. Wait, session.user.id IS the spotify ID usually?
                // Actually NextAuth callbacks usually map 'id' to the provider's ID.
                spotifyId: session.user.id,
                email: session.user.email,
                name: session.user.name,
                image: session.user.image,
            }
        });

        const newPlaylist = await prisma.savedPlaylist.create({
            data: {
                spotifyId,
                userId: session.user.id,
                name: playlistMetadata.name,
                description: playlistMetadata.description,
                imageUrl: playlistMetadata.imageUrl
            }
        });

        return NextResponse.json({ playlist: newPlaylist });

    } catch (error: any) {
        // Handle unique constraint error
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Playlist already saved" }, { status: 409 });
        }
        console.error("Error saving playlist:", error);
        return NextResponse.json({ error: "Failed to save playlist" }, { status: 500 });
    }
}
