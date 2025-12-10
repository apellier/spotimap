"use client";

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PlaylistItem } from '@/types'; // Ensure PlaylistItem is compatible or define new type

export function useUserPlaylists() {
    const { data: session } = useSession();
    const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
    const [playlistsError, setPlaylistsError] = useState<string | null>(null);

    const fetchPlaylists = useCallback(async () => {
        if (!session?.user) return;
        setIsLoadingPlaylists(true);
        setPlaylistsError(null);
        try {
            const response = await fetch("/api/user/playlists");
            if (!response.ok) throw new Error((await response.json()).error || "Failed to fetch playlists");
            const data = await response.json();

            // Map DB playlists to UI PlaylistItem type
            // DB: { id, spotifyId, name, description, imageUrl, ... }
            // UI: { id, name, tracks: { total: number } } -> We might need to adjust UI type or map here
            // For now, let's map roughly.
            const mapped = data.playlists.map((p: any) => ({
                id: p.spotifyId, // We use spotifyId for fetching tracks later
                dbId: p.id, // Keep DB id for deletion
                name: p.name,
                tracks: { total: 0 }, // We don't store total count in DB yet, maybe optional
                images: p.imageUrl ? [{ url: p.imageUrl }] : []
            }));
            setPlaylists(mapped || []);
        } catch (err: any) {
            setPlaylistsError(err.message);
        } finally {
            setIsLoadingPlaylists(false);
        }
    }, [session]);

    // Fetch on mount/auth
    useEffect(() => {
        if (session?.user) {
            fetchPlaylists();
        }
    }, [session, fetchPlaylists]);

    return {
        playlists,
        isLoadingPlaylists,
        playlistsError,
        fetchPlaylists
    };
}
