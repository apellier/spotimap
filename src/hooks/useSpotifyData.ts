// src/hooks/useSpotifyData.ts
import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { callSpotifyApi } from '@/lib/spotifyApi'; // Assuming you moved it
import { LikedSongItem, PlaylistItem, PlaylistTrackItem } from '@/types'; // Centralized types

export function useSpotifyData() {
    const { data: session } = useSession();
    const [likedSongs, setLikedSongs] = useState<LikedSongItem[]>([]);
    const [isLoadingLikedSongs, setIsLoadingLikedSongs] = useState(false);
    const [likedSongsError, setLikedSongsError] = useState<string | null>(null);
    // ... (similar states for playlists, playlistTracks)
    const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
    const [playlistsError, setPlaylistsError] = useState<string | null>(null);
    const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackItem[]>([]);
    const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);
    const [playlistTracksError, setPlaylistTracksError] = useState<string | null>(null);

    const fetchLikedSongsInternal = useCallback(async () => {
        if (!session?.accessToken) return;
        setIsLoadingLikedSongs(true); setLikedSongsError(null); setPlaylistTracks([]); // Clear other track types
        try {
            const response = await fetch("/api/spotify/liked-songs"); // Use your existing backend API route
            if (!response.ok) throw new Error((await response.json()).error || "Failed to fetch liked songs");
            const data = await response.json();
            setLikedSongs(data.tracks || []);
        } catch (err: any) { setLikedSongsError(err.message); }
        finally { setIsLoadingLikedSongs(false); }
    }, [session]);

    const fetchPlaylistsInternal = useCallback(async () => {
        if (!session?.accessToken) return;
        setIsLoadingPlaylists(true); setPlaylistsError(null);
        try {
            const response = await fetch("/api/spotify/playlists");
            if (!response.ok) throw new Error((await response.json()).error || "Failed to fetch playlists");
            const data = await response.json();
            setPlaylists(data.playlists || []);
        } catch (err: any) { setPlaylistsError(err.message); }
        finally { setIsLoadingPlaylists(false); }
    }, [session]);

    const fetchTracksForPlaylistInternal = useCallback(async (playlistId: string) => {
        if (!session?.accessToken || !playlistId) return;
        setIsLoadingPlaylistTracks(true); setPlaylistTracksError(null); setLikedSongs([]); // Clear other track types
        try {
            const response = await fetch(`/api/spotify/playlist-tracks?playlist_id=${playlistId}`);
            if (!response.ok) throw new Error((await response.json()).error || "Failed to fetch playlist tracks");
            const data = await response.json();
            setPlaylistTracks(data.tracks || []);
        } catch (err: any) { setPlaylistTracksError(err.message); }
        finally { setIsLoadingPlaylistTracks(false); }
    }, [session]);

    // Fetch playlists once on session authentication
    useEffect(() => {
        if (session?.accessToken && playlists.length === 0) { // Only fetch if not already fetched
            fetchPlaylistsInternal();
        }
    }, [session, fetchPlaylistsInternal, playlists.length]);

    return {
        likedSongs, isLoadingLikedSongs, likedSongsError, fetchLikedSongs: fetchLikedSongsInternal,
        playlists, isLoadingPlaylists, playlistsError, fetchPlaylists: fetchPlaylistsInternal,
        playlistTracks, isLoadingPlaylistTracks, playlistTracksError, fetchTracksForPlaylist: fetchTracksForPlaylistInternal,
    };
}