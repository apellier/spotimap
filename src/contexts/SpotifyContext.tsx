"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { PlaylistItem, PlaylistTrackItem, SpotifyTrack } from '@/types';
import { getSavedPlaylists, savePlaylist, removePlaylist, SavedPlaylist } from '@/utils/localStorageUtils';

interface SpotifyContextType {
    // Playlists (from localStorage)
    playlists: (PlaylistItem & { localId?: string })[];
    isLoadingPlaylists: boolean;
    addPlaylist: (spotifyId: string, name: string, url: string) => void;

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
    deletePlaylist: (spotifyId: string) => void;
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

export function SpotifyProvider({ children }: { children: ReactNode }) {
    const [localPlaylists, setLocalPlaylists] = useState<SavedPlaylist[]>([]);
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);

    const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackItem[]>([]);
    const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);

    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
    const [currentSourceLabel, setCurrentSourceLabel] = useState<string>("Select Source");

    // Load playlists from localStorage on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const saved = getSavedPlaylists();
        setLocalPlaylists(saved);
        setIsLoadingPlaylists(false);

        // Auto-select first playlist if available
        if (saved.length > 0 && !selectedPlaylistId) {
            setSelectedPlaylistId(saved[0].id);
            setCurrentSourceLabel(saved[0].name);
        }
    }, []);

    // Convert localStorage format to PlaylistItem format
    const playlists: (PlaylistItem & { localId?: string })[] = React.useMemo(() => {
        return localPlaylists.map(p => ({
            id: p.id,
            name: p.name,
            localId: p.id, // Use spotify ID as local ID too
            images: [],
            tracks: { total: 0 }, // We don't know until fetched
            owner: { display_name: 'Public' }
        }));
    }, [localPlaylists]);

    // Add a playlist (saves to localStorage)
    const addPlaylist = useCallback((spotifyId: string, name: string, url: string) => {
        const updated = savePlaylist({ id: spotifyId, name, url });
        setLocalPlaylists(updated);

        // Auto-select the newly added one
        setSelectedPlaylistId(spotifyId);
        setCurrentSourceLabel(name);
    }, []);

    // Delete a playlist (removes from localStorage)
    const deletePlaylist = useCallback((spotifyId: string) => {
        const updated = removePlaylist(spotifyId);
        setLocalPlaylists(updated);

        // If we deleted the selected one, clear or select another
        if (selectedPlaylistId === spotifyId) {
            if (updated.length > 0) {
                setSelectedPlaylistId(updated[0].id);
                setCurrentSourceLabel(updated[0].name);
            } else {
                setSelectedPlaylistId("");
                setCurrentSourceLabel("Select Source");
                setPlaylistTracks([]);
            }
        }
    }, [selectedPlaylistId]);

    // Fetch Tracks from Public Playlist (no auth needed)
    const fetchTracksForPlaylist = useCallback(async (playlistId: string) => {
        if (!playlistId) return;
        setIsLoadingPlaylistTracks(true);
        setPlaylistTracks([]);
        try {
            const response = await fetch(`/api/spotify/playlist-tracks?playlist_id=${playlistId}`);
            if (!response.ok) throw new Error((await response.json()).error || "Failed to fetch playlist tracks");
            const data = await response.json();
            setPlaylistTracks(data.tracks || []);
        } catch (err: any) {
            console.error("Error fetching tracks:", err);
        } finally {
            setIsLoadingPlaylistTracks(false);
        }
    }, []);

    // Auto-fetch tracks when selection changes
    useEffect(() => {
        if (selectedPlaylistId) {
            fetchTracksForPlaylist(selectedPlaylistId);
        }
    }, [selectedPlaylistId, fetchTracksForPlaylist]);

    const currentTracks = React.useMemo(() => {
        return playlistTracks.filter((item): item is PlaylistTrackItem & { track: SpotifyTrack } => item.track !== null);
    }, [playlistTracks]);

    // Context Value
    const value = {
        playlists,
        isLoadingPlaylists,
        addPlaylist,
        playlistTracks,
        isLoadingPlaylistTracks,
        fetchTracksForPlaylist,
        selectedPlaylistId,
        setSelectedPlaylistId,
        currentSourceLabel,
        setCurrentSourceLabel,
        currentTracks,
        deletePlaylist
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
