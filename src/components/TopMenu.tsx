// src/components/TopMenu.tsx
"use client";

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { SunIcon, MoonIcon, PlusIcon } from '@heroicons/react/24/outline';
import { PlaylistItem } from '@/types';

interface TopMenuProps {
    isLoggedIn: boolean;
    userName?: string | null;
    onSignOut: () => void;
    onSignIn: () => void;
    currentSourceLabel: string;
    // onFetchLikedSongs removed
    playlists: (PlaylistItem & { dbId?: string })[]; // Updated type
    selectedPlaylistId: string;
    onPlaylistChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    isLoadingData: boolean;
    isLoadingPlaylists: boolean;
    unknownsCount: number;
    onUnknownsClick: () => void;
    onAddPlaylist: () => void; // New prop
    onDeletePlaylist: (dbId: string) => void; // New prop
}

const TopMenu: React.FC<TopMenuProps> = ({
    isLoggedIn, userName, onSignOut, onSignIn,
    currentSourceLabel, playlists, selectedPlaylistId, onPlaylistChange,
    isLoadingData, isLoadingPlaylists,
    unknownsCount, onUnknownsClick,
    onAddPlaylist, onDeletePlaylist
}) => {
    const { theme: currentTheme, toggleTheme: onToggleTheme } = useTheme();

    return (
        <nav className="fixed top-0 left-0 right-0 z-[900] border-b border-nb-border bg-nb-bg shadow-nb">
            <div className="mx-auto flex h-auto min-h-[55px] flex-wrap items-center justify-between gap-y-2 px-nb-sm py-2 sm:flex-nowrap sm:px-nb-md md:max-w-screen-xl">
                {/* Left Section */}
                <div className="flex items-center gap-nb-xs sm:gap-nb-sm">
                    {isLoggedIn && (
                        <>
                            <span className="mr-nb-xs whitespace-nowrap text-xs text-nb-text/70">
                                <span className="hidden sm:inline">Welcome </span>{userName || 'User'}!
                            </span>
                            <button
                                onClick={onSignOut}
                                className={`btn btn-destructive px-nb-sm py-1 text-xs`}
                            >
                                Sign Out
                            </button>
                        </>
                    )}
                </div>

                {/* Center Section */}
                {isLoggedIn && (
                    <div className="flex w-full flex-col items-stretch gap-nb-sm order-last
                                   sm:order-none sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-nb-sm">

                        {/* Selector */}
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedPlaylistId}
                                onChange={onPlaylistChange}
                                disabled={isLoadingData || (!isLoadingPlaylists && playlists.length === 0)}
                                className="w-full rounded-nb border-nb border-nb-border bg-nb-bg px-nb-sm py-[7px] text-xs font-semibold uppercase text-nb-text focus:border-nb-accent focus:outline-nb-accent focus:outline-offset-1 focus:ring-0 sm:max-w-[200px] md:max-w-[220px]"
                            >
                                <option value="">
                                    {isLoadingPlaylists ? "Loading..." : (playlists.length === 0 ? "No Saved Playlists" : "Select Playlist...")}
                                </option>
                                {playlists.map((playlist) => (
                                    <option key={playlist.id} value={playlist.id}>
                                        {playlist.name}
                                    </option>
                                ))}
                            </select>

                            {/* Delete Button (only if playlist selected) */}
                            {selectedPlaylistId && (
                                <button
                                    onClick={() => {
                                        const p = playlists.find(pl => pl.id === selectedPlaylistId);
                                        if (p?.dbId && confirm(`Delete playlist "${p.name}"?`)) {
                                            onDeletePlaylist(p.dbId);
                                        }
                                    }}
                                    className="btn btn-outline text-xs px-2 py-1 text-nb-accent-destructive border-nb-accent-destructive hover:bg-nb-accent-destructive hover:text-white"
                                    title="Remove this playlist"
                                >
                                    &times;
                                </button>
                            )}

                            <button
                                onClick={onAddPlaylist}
                                className="btn btn-accent px-nb-sm py-1 text-xs flex items-center gap-1"
                                title="Add a public playlist by URL"
                            >
                                <PlusIcon className="w-3 h-3" />
                                Add
                            </button>
                        </div>
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
                            Unknowns ({unknownsCount})
                        </button>
                    )}
                    <button
                        onClick={onToggleTheme}
                        className={`btn btn-icon p-nb-xs`}
                        aria-label="Toggle theme"
                    >
                        {currentTheme === 'light' ?
                            <MoonIcon className="h-4 w-4 text-nb-text group-hover:text-nb-text-on-accent" /> :
                            <SunIcon className="h-4 w-4 text-nb-text group-hover:text-nb-text-on-accent" />}
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
            </div>
        </nav>
    );
};

export default TopMenu;