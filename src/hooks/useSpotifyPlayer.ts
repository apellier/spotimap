"use client";

import { useState, useCallback } from 'react';
import { useSpotifyContext } from '@/contexts/SpotifyContext';
import { callSpotifyApi } from '@/lib/spotifyApi';

export function useSpotifyPlayer() {
    const { session, getSpotifyDeviceId } = useSpotifyContext();

    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [playbackLoading, setPlaybackLoading] = useState<string | null>(null);
    const [playlistCreationStatus, setPlaylistCreationStatus] = useState<string | null>(null);
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

    const playSong = useCallback(async (trackId: string) => {
        if (!session?.accessToken || !trackId) {
            setPlaybackError("Authentication or Track ID missing."); return;
        }
        setPlaybackLoading(trackId);
        setPlaybackError(null);
        try {
            const deviceId = await getSpotifyDeviceId();
            if (!deviceId) {
                setPlaybackError("No active Spotify player found. Please open Spotify and play something, or ensure a device is available.");
                setPlaybackLoading(null); return;
            }
            await callSpotifyApi('/me/player/play', 'PUT', session.accessToken, { uris: [`spotify:track:${trackId}`], device_id: deviceId });
        } catch (error: any) {
            console.error("Error playing song:", error);
            let userMessage = "Failed to play song. Please ensure Spotify is open and responsive.";
            if (error.message) {
                if (error.message.includes("NO_ACTIVE_DEVICE")) userMessage = "No active Spotify device. Please start playback in your Spotify app and try again.";
                else if (error.message.includes("PREMIUM_REQUIRED")) userMessage = "Spotify Premium is required for this action.";
                else if (error.message.includes("Device not found")) userMessage = "Could not connect to the Spotify player. Please ensure it's active.";
                else if (error.message.length < 150) userMessage = error.message;
            }
            setPlaybackError(userMessage);
        } finally { setPlaybackLoading(null); }
    }, [session, getSpotifyDeviceId]);

    const playTracks = useCallback(async (trackUris: string[]) => {
        if (!session?.accessToken || trackUris.length === 0) {
            setPlaybackError("Authentication missing or no tracks.");
            return;
        }
        setPlaybackLoading("tracks-shuffling");
        setPlaybackError(null);
        try {
            const deviceId = await getSpotifyDeviceId();
            if (!deviceId) {
                setPlaybackError("No active Spotify player found.");
                setPlaybackLoading(null);
                return;
            }
            // Shuffle locally if needed, but here we just play what is passed
            // Usually the UI handles shuffling the array before passing it, or we use Spotify's shuffle mode
            await callSpotifyApi(`/me/player/shuffle?state=true&device_id=${deviceId}`, 'PUT', session.accessToken);
            await callSpotifyApi('/me/player/play', 'PUT', session.accessToken, { uris: trackUris, device_id: deviceId });
        } catch (error: any) {
            let userMessage = "Failed to play. Ensure Spotify is open, responsive, and Premium if required.";
            if (error.message) {
                if (error.message.includes("NO_ACTIVE_DEVICE")) userMessage = "No active Spotify device.";
                else if (error.message.includes("PREMIUM_REQUIRED")) userMessage = "Spotify Premium may be required.";
                else if (error.message.length < 150) userMessage = error.message;
            }
            setPlaybackError(userMessage);
        } finally { setPlaybackLoading(null); }
    }, [session, getSpotifyDeviceId]);

    const createPlaylist = useCallback(async (name: string, description: string, trackUris: string[]) => {
        if (!session?.accessToken || !session.user?.id) {
            setPlaylistCreationStatus("Auth or user ID missing.");
            setIsCreatingPlaylist(false);
            return;
        }
        setIsCreatingPlaylist(true);
        setPlaylistCreationStatus("Creating playlist...");
        setPlaybackError(null);

        if (trackUris.length === 0) {
            setPlaylistCreationStatus("No songs to add.");
            setIsCreatingPlaylist(false);
            return;
        }

        try {
            const newPlaylist = await callSpotifyApi(`/users/${session.user.id}/playlists`, 'POST', session.accessToken, {
                name: name,
                public: false,
                description: description
            });

            if (!newPlaylist?.id) throw new Error("Failed to create playlist.");

            setPlaylistCreationStatus(`Playlist "${newPlaylist.name}" created! Adding songs...`);
            const CHUNK_SIZE = 100;
            for (let i = 0; i < trackUris.length; i += CHUNK_SIZE) {
                await callSpotifyApi(`/playlists/${newPlaylist.id}/tracks`, 'POST', session.accessToken, { uris: trackUris.slice(i, i + CHUNK_SIZE) });
            }
            setPlaylistCreationStatus(`Added ${trackUris.length} songs to "${newPlaylist.name}"!`);
        } catch (error: any) {
            let userMessage = "Failed to save playlist.";
            if (error.message && error.message.length < 150) userMessage = `Error: ${error.message}`;
            setPlaylistCreationStatus(userMessage);
        } finally { setIsCreatingPlaylist(false); }
    }, [session]);

    return {
        playbackError,
        setPlaybackError,
        playbackLoading,
        playlistCreationStatus,
        isCreatingPlaylist,
        playSong,
        playTracks,
        createPlaylist
    };
}
