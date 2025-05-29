// src/components/TopMenu.tsx
"use client";

import React from 'react';
import styles from './TopMenu.module.css';
import { useTheme } from '@/contexts/ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { PlaylistItem } from '@/types';

interface TopMenuProps {
    isLoggedIn: boolean;
    userName?: string | null;
    onSignOut: () => void;
    onSignIn: () => void;
    currentSourceLabel: string;
    onFetchLikedSongs: () => void;
    playlists: PlaylistItem[];
    selectedPlaylistId: string;
    onPlaylistChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    isLoadingData: boolean; // General loading state for disabling buttons
    isLoadingPlaylists: boolean; // Specific loading state for playlist dropdown text
    unknownsCount: number;
    onUnknownsClick: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({
    isLoggedIn, userName, onSignOut, onSignIn,
    currentSourceLabel, onFetchLikedSongs, playlists, selectedPlaylistId, onPlaylistChange,
    isLoadingData, isLoadingPlaylists, // Destructure new prop
    unknownsCount, onUnknownsClick
}) => {
    const { theme: currentTheme, toggleTheme: onToggleTheme } = useTheme();
    const baseButtonTwClasses = "px-nb-sm py-[5px] text-xs font-semibold";

    return (
        <nav className="fixed top-0 left-0 z-[900] flex h-[55px] w-full items-center justify-between border-b border-nb-border bg-nb-bg px-nb-md shadow-nb">
            {/* Left Section */}
            <div className="flex items-center gap-nb-sm">
                {isLoggedIn && (
                    <>
                        <span className="mr-nb-xs whitespace-nowrap text-xs text-nb-text/70">
                            Bienvenue {userName || 'User'}!
                        </span>
                        <button
                            onClick={onSignOut}
                            className={`btn btn-destructive px-nb-sm py-1 text-xs`}
                        >
                            Déconnexion
                        </button>
                    </>
                )}
            </div>

            {/* Center Section */}
            <div className="flex flex-grow items-center justify-center gap-nb-sm">
                {isLoggedIn && (
                    <>
                        <span className="mr-nb-xs text-xs uppercase text-nb-text/70">
                            Afficher :
                        </span>
                        <button
                            onClick={onFetchLikedSongs}
                            className={`btn px-nb-sm py-1 text-xs ${currentSourceLabel === "Liked Songs" ? 'btn-accent' : 'btn-outline'}`}
                            disabled={isLoadingData}
                        >
                            Titres Likés
                        </button>
                        <select
                            value={selectedPlaylistId}
                            onChange={onPlaylistChange}
                            disabled={isLoadingData || (!isLoadingPlaylists && playlists.length === 0)} // Disable if generally loading OR specifically no playlists and not loading them
                            className="max-w-[200px] px-nb-sm py-[7px] text-xs uppercase"
                        >
                            {/* Use isLoadingPlaylists for specific loading text here */}
                            <option value="">
                                {isLoadingPlaylists ? "Chargement Playlists..." : (playlists.length === 0 ? "Aucune Playlist" : "Choisir une Playlist...")}
                            </option>
                            {playlists.map((playlist) => (
                                <option key={playlist.id} value={playlist.id}>
                                    {playlist.name} ({playlist.tracks.total})
                                </option>
                            ))}
                        </select>
                    </>
                )}
            </div>

            {/* Right Section (as before, using isLoadingData for general disable state) */}
            <div className="flex items-center gap-nb-sm">
                 {isLoggedIn && (
                    <button
                        onClick={onUnknownsClick}
                        className={`btn btn-outline px-nb-sm py-1 text-xs`}
                        disabled={isLoadingData || unknownsCount === 0}
                    >
                        Inconnus ({unknownsCount})
                    </button>
                )}
                <button
                    onClick={onToggleTheme}
                    className={`btn btn-icon p-nb-xs`}
                    aria-label="Toggle theme"
                >
                    {currentTheme === 'light' ?
                        <MoonIcon className="h-4 w-4 text-nb-text group-hover:text-nb-accent-text" /> :
                        <SunIcon className="h-4 w-4 text-nb-text group-hover:text-nb-accent-text" />}
                </button>
                {!isLoggedIn && (
                     <button
                        onClick={onSignIn}
                        className={`btn btn-accent px-nb-md py-nb-sm text-sm`}
                     >
                        Sign In
                    </button>
                )}
            </div>
        </nav>
    );
};

export default TopMenu;