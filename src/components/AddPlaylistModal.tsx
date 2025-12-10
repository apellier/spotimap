"use client";

import React, { useState } from 'react';
import { useSpotifyContext } from '@/contexts/SpotifyContext';

interface AddPlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AddPlaylistModal({ isOpen, onClose }: AddPlaylistModalProps) {
    const { fetchPlaylists } = useSpotifyContext();
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/user/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spotifyUrl: url }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to add playlist");
            }

            // Success
            setUrl('');
            await fetchPlaylists(); // Refresh list
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
                    Paste the link to any PUBLIC Spotify playlist.
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
