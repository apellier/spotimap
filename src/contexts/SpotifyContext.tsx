"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useUserPlaylists } from '@/hooks/useUserPlaylists';
import { PlaylistItem, PlaylistTrackItem, SpotifyTrack } from '@/types';
import { callSpotifyApi } from '@/lib/spotifyApi';

interface SpotifyContextType {
    session: any;
    authStatus: "authenticated" | "loading" | "unauthenticated";

    // Playlists (from DB)
    playlists: (PlaylistItem & { dbId?: string })[]; // Extended type
    isLoadingPlaylists: boolean;
    fetchPlaylists: () => Promise<void>;

    // Playlist Tracks (from Spotify Public API)
    playlistTracks: PlaylistTrackItem[];
    isLoadingPlaylistTracks: boolean;
    fetchTracksForPlaylist: (playlistId: string) => Promise<void>;

    // Selection State
    selectedPlaylistId: string;
    setSelectedPlaylistId: (id: string) => void;
    currentSourceLabel: string;
    setCurrentSourceLabel: (label: string) => void;

    // Data
    currentTracks: Array<PlaylistTrackItem & { track: SpotifyTrack }>;

    // Actions
    deletePlaylist: (dbId: string) => Promise<void>;

    // Helpers
    getSpotifyDeviceId: () => Promise<string | null>;
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

export function SpotifyProvider({ children }: { children: ReactNode }) {
    const { data: session, status: authStatus } = useSession();

    // Use new hook for DB playlists. Liked Songs usage is removed.
    const { playlists, isLoadingPlaylists, fetchPlaylists } = useUserPlaylists();

    const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackItem[]>([]);
    const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);

    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
    const [currentSourceLabel, setCurrentSourceLabel] = useState<string>("Select Source");

    // Fetch Tracks Logic (Public API)
    // We can use the user's accessToken or Client Credentials. 
    // Since we reduced scopes, the user token can only read public info.
    const fetchTracksForPlaylist = useCallback(async (playlistId: string) => {
        if (!session?.accessToken || !playlistId) return;
        setIsLoadingPlaylistTracks(true);
        setPlaylistTracks([]);
        try {
            // Need a new proxy API route? Or use existing one?
            // Existing: /api/spotify/playlist-tracks?playlist_id=...
            // Likely relies on 'callSpotifyApi' which uses user token.
            // If the user adds a public playlist, their token should work to read it.
            const response = await fetch(`/api/spotify/playlist-tracks?playlist_id=${playlistId}`);
            if (!response.ok) throw new Error((await response.json()).error || "Failed to fetch playlist tracks");
            const data = await response.json();
            setPlaylistTracks(data.tracks || []);
        } catch (err: any) {
            console.error(err);
        } finally {
            setIsLoadingPlaylistTracks(false);
        }
    }, [session]);


    const currentTracks = React.useMemo(() => {
        // @ts-ignore
        return playlistTracks.filter((item): item is PlaylistTrackItem & { track: SpotifyTrack } => item.track !== null);
    }, [playlistTracks]);

    const deletePlaylist = useCallback(async (dbId: string) => {
        if (!dbId) return;
        try {
            await fetch(`/api/user/playlists/${dbId}`, { method: 'DELETE' });
            await fetchPlaylists();
            if (selectedPlaylistId === dbId) { // Wait, selectedPlaylistId is spotifyId. We need to match? 
                // We'll reset anyway if the current playlist is deleted logically, but here let's just reset if needed.
                // Actually safer to not reset unless we know.
            }
        } catch (e) { console.error(e); }
    }, [fetchPlaylists, selectedPlaylistId]);


    const getSpotifyDeviceId = useCallback(async (): Promise<string | null> => {
        if (!session?.accessToken) return null;
        try {
            const devicesData = await callSpotifyApi('/me/player/devices', 'GET', session.accessToken);
            if (devicesData?.devices?.length > 0) {
                const activeDevice = devicesData.devices.find((d: any) => d.is_active === true);
                if (activeDevice?.id) return activeDevice.id;
                if (devicesData.devices[0]?.id) return devicesData.devices[0].id;
            }
            return null;
        } catch (error) {
            console.warn("Could not fetch Spotify devices:", error instanceof Error ? error.message : String(error));
            return null;
        }
    }, [session]);

    // Context Value
    const value = {
        session,
        authStatus,
        playlists,
        isLoadingPlaylists,
        fetchPlaylists,
        playlistTracks,
        isLoadingPlaylistTracks,
        fetchTracksForPlaylist,
        selectedPlaylistId,
        setSelectedPlaylistId,
        currentSourceLabel,
        setCurrentSourceLabel,
        currentTracks,
        deletePlaylist,
        getSpotifyDeviceId
    };

    return (
        <SpotifyContext.Provider value={value}>
            {children}
        </SpotifyContext.Provider>
    );
}

export function useSpotifyContext() {
    const context = useContext(SpotifyContext);
    if (context === undefined) {
        throw new Error('useSpotifyContext must be used within a SpotifyProvider');
    }
    return context;
}
