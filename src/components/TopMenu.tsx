// src/components/TopMenu.tsx
"use client";

import React from 'react';
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
    isLoadingData: boolean;
    isLoadingPlaylists: boolean;
    unknownsCount: number;
    onUnknownsClick: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({
    isLoggedIn, userName, onSignOut, onSignIn,
    currentSourceLabel, onFetchLikedSongs, playlists, selectedPlaylistId, onPlaylistChange,
    isLoadingData, isLoadingPlaylists,
    unknownsCount, onUnknownsClick
}) => {
    const { theme: currentTheme, toggleTheme: onToggleTheme } = useTheme();

    return (
        <nav className="fixed top-0 left-0 z-[900] flex flex-wrap items-center justify-between gap-y-2 border-b border-nb-border bg-nb-bg px-nb-sm py-2 shadow-nb sm:h-[55px] sm:flex-nowrap sm:px-nb-md sm:py-0">
            {/* Left Section */}
            <div className="flex items-center gap-nb-xs sm:gap-nb-sm">
                {isLoggedIn && (
                    <>
                        <span className="mr-nb-xs whitespace-nowrap text-xs text-nb-text/70">
                            {/* Corrected: hidden on base (mobile), inline from sm up */}
                            <span className="hidden sm:inline">Bienvenue </span>{userName || 'User'}!
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
            {isLoggedIn && (
                 <div className="flex w-full flex-col items-stretch gap-nb-sm order-last
                               sm:order-none sm:w-auto sm:flex-row sm:flex-grow sm:items-center sm:justify-center sm:gap-nb-sm">
                    {/* Label "Afficher :" for desktop */}
                    <span className="hidden text-xs uppercase text-nb-text/70 sm:inline-block sm:mr-nb-xs">
                        Afficher :
                    </span>
                    <button
                        onClick={onFetchLikedSongs}
                        className={`btn w-full px-nb-sm py-1 text-xs sm:w-auto ${currentSourceLabel === "Liked Songs" ? 'btn-accent' : 'btn-outline'}`}
                        disabled={isLoadingData}
                    >
                        Titres Likés
                    </button>
                    <select
                        value={selectedPlaylistId}
                        onChange={onPlaylistChange}
                        disabled={isLoadingData || (!isLoadingPlaylists && playlists.length === 0)}
                        className="w-full px-nb-sm py-[7px] text-xs uppercase sm:max-w-[200px] md:max-w-[220px]"
                    >
                        <option value="">
                            {isLoadingPlaylists ? "Chargement Playlists..." : (playlists.length === 0 ? "Aucune Playlist" : "Choisir une Playlist...")}
                        </option>
                        {playlists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                                {playlist.name} ({playlist.tracks.total})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Right Section */}
            <div className="flex items-center gap-nb-xs sm:gap-nb-sm">
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