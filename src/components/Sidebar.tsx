"use client";

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import {
    HomeIcon,
    MusicalNoteIcon,
    ClockIcon,
    WrenchScrewdriverIcon,
    SunIcon,
    MoonIcon,
    ArrowRightOnRectangleIcon,
    ShareIcon,
    ListBulletIcon,
    ArrowPathIcon,
    PlusIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { PlaylistItem } from '@/types';

interface SidebarProps {

    // Playlist
    playlists: (PlaylistItem & { localId?: string })[];
    selectedPlaylistId: string;
    onPlaylistChange: (newId: string) => void;
    onAddPlaylist: () => void;
    onDeletePlaylist: (spotifyId: string) => void;
    isLoadingPlaylists: boolean;

    // Map Controls
    isTimelineActive: boolean;
    onToggleTimeline: () => void;

    isMultiSelectModeActive: boolean;
    onToggleMultiSelect: () => void;
    multiSelectedCountriesCount: number;
    onShowMultiCountryDetails: () => void;

    isExporting: boolean;
    onExportMap: () => void;

    // Unknowns
    unknownsCount: number;
    onUnknownsClick: () => void;
    isRescanning: boolean;
    onRescanUnknowns: () => void;

    // Stats for ShareCard
    totalSongs: number;
    totalCountries: number;
    topCountries: Array<{ name: string; count: number }>;
}

import { ShareCard } from './ShareCard';
import html2canvas from 'html2canvas';

export default function Sidebar({
    playlists, selectedPlaylistId, onPlaylistChange, onAddPlaylist, onDeletePlaylist, isLoadingPlaylists,
    isTimelineActive, onToggleTimeline,
    isMultiSelectModeActive, onToggleMultiSelect, multiSelectedCountriesCount, onShowMultiCountryDetails,
    isExporting, onExportMap,
    unknownsCount, onUnknownsClick, isRescanning, onRescanUnknowns,
    totalSongs, totalCountries, topCountries
}: SidebarProps) {
    const { theme, toggleTheme } = useTheme();

    // Local state for popovers
    const [activePopover, setActivePopover] = useState<'playlist' | 'tools' | null>(null);
    const [isGeneratingShare, setIsGeneratingShare] = useState(false);
    const shareCardRef = React.useRef<HTMLDivElement>(null);

    const togglePopover = (name: 'playlist' | 'tools') => {
        setActivePopover(activePopover === name ? null : name);
    };

    const currentPlaylistName = playlists.find(p => p.id === selectedPlaylistId)?.name || "Select Playlist";

    const handleGenerateShareCard = async () => {
        if (!shareCardRef.current || isGeneratingShare) return;
        setIsGeneratingShare(true);
        setActivePopover(null);

        try {
            // Slight delay to ensure render
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(shareCardRef.current, {
                backgroundColor: null, // Transparent background if possible, or matches theme
                scale: 2 // High res
            });

            const image = canvas.toDataURL("image/png");

            // Download
            const link = document.createElement('a');
            link.href = image;
            link.download = `spotimap-passport-${new Date().toISOString().slice(0, 10)}.png`;
            link.click();

        } catch (error) {
            console.error("Failed to generate share card", error);
            alert("Failed to create image. Please try again.");
        } finally {
            setIsGeneratingShare(false);
        }
    };

    return (
        <aside className="fixed left-0 top-0 bottom-0 z-[1000] flex w-16 flex-col items-center justify-between border-r border-nb-border bg-nb-bg py-4 shadow-nb">

            {/* Hidden Share Card for Generation */}
            <div className="absolute -left-[9999px] top-0">
                <ShareCard
                    ref={shareCardRef}
                    totalSongs={totalSongs}
                    totalCountries={totalCountries}
                    topCountries={topCountries}
                />
            </div>

            {/* TOP: Logo & Main Nav */}
            <div className="flex flex-col items-center gap-6 w-full">
                {/* Logo */}
                <div className="flex h-10 w-10 items-center justify-center rounded-nb border border-nb-border bg-nb-accent text-nb-text-on-accent font-bold text-lg cursor-pointer shadow-nb-accent hover:translate-y-[2px] transition-transform" title="SpotiMap">
                    SM
                </div>

                {/* Navigation */}
                <div className="flex flex-col gap-4 w-full items-center">

                    {/* Playlist (Main Action) */}
                    <div className="relative group">
                        <button
                            onClick={() => togglePopover('playlist')}
                            className={`btn btn-icon w-10 h-10 ${selectedPlaylistId ? 'text-nb-accent border-nb-accent' : ''}`}
                            title={currentPlaylistName}
                        >
                            <MusicalNoteIcon className="w-5 h-5" />
                        </button>

                        {/* Playlist Popover */}
                        {activePopover === 'playlist' && (
                            <div className="absolute left-14 top-0 w-64 rounded-nb border border-nb-border bg-nb-bg p-3 shadow-nb z-50 animate-in fade-in slide-in-from-left-4">
                                <h4 className="mb-2 text-xs font-bold uppercase text-nb-text/50">Playlists</h4>
                                <div className="max-h-60 overflow-y-auto space-y-1 mb-2">
                                    {playlists.length === 0 ? (
                                        <p className="text-sm text-nb-text/70 italic px-2">No playlists found.</p>
                                    ) : (
                                        playlists.map(playlist => (
                                            <div key={playlist.id} className="flex items-center justify-between group/item hover:bg-nb-bg-alt rounded p-1">
                                                <button
                                                    onClick={() => { onPlaylistChange(playlist.id); setActivePopover(null); }}
                                                    className={`text-sm truncate text-left w-full ${playlist.id === selectedPlaylistId ? 'font-bold text-nb-accent' : 'text-nb-text'}`}
                                                >
                                                    {playlist.name}
                                                </button>
                                                {playlist.localId && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) onDeletePlaylist(playlist.id); }}
                                                        className="hidden group-hover/item:block text-nb-accent-destructive p-1 hover:bg-nb-bg"
                                                    >
                                                        &times;
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                                <button
                                    onClick={() => { onAddPlaylist(); setActivePopover(null); }}
                                    className="btn btn-accent w-full text-xs py-2 flex items-center justify-center gap-2"
                                >
                                    <PlusIcon className="w-4 h-4" /> Add Public Playlist
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <button
                        onClick={onToggleTimeline}
                        className={`btn btn-icon w-10 h-10 ${isTimelineActive ? 'bg-nb-accent text-nb-text-on-accent border-nb-accent' : ''}`}
                        title="Toggle Time Travel"
                    >
                        <ClockIcon className="w-5 h-5" />
                    </button>

                    {/* Tools Menu */}
                    <div className="relative">
                        <button
                            onClick={() => togglePopover('tools')}
                            className="btn btn-icon w-10 h-10"
                            title="Tools (Multi-select, Export, Unknowns)"
                        >
                            <WrenchScrewdriverIcon className="w-5 h-5" />
                        </button>

                        {/* Tools Popover */}
                        {activePopover === 'tools' && (
                            <div className="absolute left-14 top-0 w-56 rounded-nb border border-nb-border bg-nb-bg p-2 shadow-nb z-50 space-y-2 animate-in fade-in slide-in-from-left-4">
                                <h4 className="px-2 py-1 text-xs font-bold uppercase text-nb-text/50 border-b border-nb-border/30">Map Tools</h4>

                                {/* Multi Select */}
                                <button onClick={() => { onToggleMultiSelect(); setActivePopover(null); }} className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-nb-bg-alt flex items-center gap-2 ${isMultiSelectModeActive ? 'bg-nb-accent/10 text-nb-accent' : ''}`}>
                                    <ListBulletIcon className="w-4 h-4" />
                                    {isMultiSelectModeActive ? 'Exit Select Mode' : 'Multi-Select Countries'}
                                </button>

                                {/* View Details (if Multi selected) */}
                                <button onClick={() => { onShowMultiCountryDetails(); setActivePopover(null); }} disabled={multiSelectedCountriesCount === 0} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-nb-bg-alt flex items-center gap-2 disabled:opacity-50">
                                    <MagnifyingGlassIcon className={`w-4 h-4 ${multiSelectedCountriesCount > 0 ? 'text-nb-accent' : ''}`} /> View Selected ({multiSelectedCountriesCount})
                                </button>

                                {/* Unknowns */}
                                <button onClick={() => { onUnknownsClick(); setActivePopover(null); }} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-nb-bg-alt flex items-center gap-2">
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-nb-bg-alt text-[10px] font-bold border border-nb-border">{unknownsCount}</span>
                                    Unknown Artists
                                </button>

                                {/* Rescan */}
                                <button onClick={onRescanUnknowns} disabled={isRescanning} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-nb-bg-alt flex items-center gap-2 disabled:opacity-50">
                                    <ArrowPathIcon className={`w-4 h-4 ${isRescanning ? 'animate-spin' : ''}`} />
                                    Rescan Unknowns
                                </button>

                                <div className="border-t border-nb-border/30 my-1"></div>

                                {/* Export */}
                                <button onClick={onExportMap} disabled={isExporting} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-nb-bg-alt flex items-center gap-2">
                                    <ArrowRightOnRectangleIcon className="w-4 h-4" /> Export Map
                                </button>

                                {/* Share Passport */}
                                <button onClick={handleGenerateShareCard} disabled={isGeneratingShare || totalSongs === 0} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-nb-bg-alt flex items-center gap-2 text-nb-accent font-semibold disabled:opacity-50">
                                    <ShareIcon className={`w-4 h-4 ${isGeneratingShare ? 'animate-pulse' : ''}`} />
                                    {isGeneratingShare ? 'Generating...' : 'Share Passport'}
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* BOTTOM: Theme Toggle */}
            <div className="flex flex-col items-center gap-4 w-full mb-2">
                <button onClick={toggleTheme} className="btn btn-icon w-10 h-10" title="Toggle Theme">
                    {theme === 'dark' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                </button>
            </div>
        </aside>
    );
}
