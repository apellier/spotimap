"use client";

import React, { useState } from 'react';
import { useSpotifyContext } from '@/contexts/SpotifyContext';

interface AddPlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Extract playlist ID from various Spotify URL formats
function extractPlaylistId(input: string): string | null {
    // Handle direct ID
    if (/^[a-zA-Z0-9]{22}$/.test(input)) {
        return input;
    }

    // Handle URLs like:
    // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
    // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
    // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
    const urlMatch = input.match(/playlist[/:]([a-zA-Z0-9]{22})/);
    if (urlMatch) {
        return urlMatch[1];
    }

    return null;
}

export default function AddPlaylistModal({ isOpen, onClose }: AddPlaylistModalProps) {
    const { addPlaylist } = useSpotifyContext();
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const playlistId = extractPlaylistId(url.trim());

            if (!playlistId) {
                throw new Error("Invalid Spotify playlist URL or ID");
            }

            // Fetch playlist details from our API to get the name
            const res = await fetch(`/api/spotify/playlist-info?playlist_id=${playlistId}`);

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to fetch playlist info. Make sure it's a public playlist.");
            }

            const playlistData = await res.json();

            // Add to localStorage via context
            addPlaylist(playlistId, playlistData.name, url);

            // Success - reset and close
            setUrl('');
            onClose();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-nb border border-nb-border bg-nb-bg p-6 shadow-nb">
                <h2 className="mb-4 text-xl font-bold text-nb-text">Add Public Playlist</h2>
                <p className="mb-4 text-sm text-nb-text/70">
                    Paste a link to any <strong>public</strong> Spotify playlist to visualize it on the map.
                </p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="https://open.spotify.com/playlist/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full rounded-nb border border-nb-border bg-nb-bg-alt px-3 py-2 text-nb-text focus:border-nb-accent focus:outline-none"
                    />

                    {error && (
                        <p className="mt-2 text-sm text-nb-accent-destructive">{error}</p>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-outline px-4 py-2 text-sm"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-accent px-4 py-2 text-sm"
                            disabled={isLoading || !url}
                        >
                            {isLoading ? 'Adding...' : 'Add Playlist'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
