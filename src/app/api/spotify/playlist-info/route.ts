import { NextResponse } from 'next/server';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_PLAYLIST_URL = 'https://api.spotify.com/v1/playlists';

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
    });

    if (!res.ok) {
        throw new Error("Failed to get Spotify access token");
    }

    const data = await res.json();
    return data.access_token;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const playlistId = searchParams.get('playlist_id');

    if (!playlistId) {
        return NextResponse.json({ error: 'Playlist ID required' }, { status: 400 });
    }

    try {
        const token = await getClientCredentialsToken();

        const playlistRes = await fetch(`${SPOTIFY_PLAYLIST_URL}/${playlistId}?fields=id,name,description,images,owner,tracks.total`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!playlistRes.ok) {
            if (playlistRes.status === 404) {
                return NextResponse.json({ error: 'Playlist not found or is not public' }, { status: 404 });
            }
            throw new Error(`Spotify API error: ${playlistRes.status}`);
        }

        const playlist = await playlistRes.json();

        return NextResponse.json({
            id: playlist.id,
            name: playlist.name,
            description: playlist.description,
            images: playlist.images,
            owner: playlist.owner?.display_name,
            totalTracks: playlist.tracks?.total || 0,
        });

    } catch (error: any) {
        console.error("Error fetching playlist info:", error);
        return NextResponse.json({ error: error.message || 'Failed to fetch playlist' }, { status: 500 });
    }
}
