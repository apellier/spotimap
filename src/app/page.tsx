"use client";

import React, { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Providers
import { SpotifyProvider, useSpotifyContext } from "@/contexts/SpotifyContext";
import { MapProvider, useMapContext } from "@/contexts/MapContext";

// Components
import Sidebar from '@/components/Sidebar';
import StatusLoader from '@/components/StatusLoader';
import MapContainer from "@/components/features/MapContainer";
import ControlsContainer from "@/components/features/ControlsContainer";
import AddPlaylistModal from '@/components/AddPlaylistModal';

// Hooks
import { useTimeline } from "@/hooks/useTimeline";

function AppLayout() {
    const {
        playlists,
        isLoadingPlaylists,
        isLoadingPlaylistTracks,
        fetchTracksForPlaylist,
        selectedPlaylistId,
        setSelectedPlaylistId,
        currentSourceLabel,
        setCurrentSourceLabel,
        currentTracks,
        deletePlaylist,
        addPlaylist
    } = useSpotifyContext();

    const {
        unknownsCount,
        isUnknownsWindowOpen,
        setIsUnknownsWindowOpen,
        loaderMessage: contextLoaderMessage,
        closeAnyPanelAndResets,
        isMultiSelectModeActive,
        setIsMultiSelectModeActive,
        multiSelectedCountries,
        handleShowMultiCountryDetails,
        countrySongCounts // Added for stats
    } = useMapContext();

    const timeline = useTimeline();

    // -- Local State --
    const [isExportingMap, setIsExportingMap] = useState(false);
    const [isRescanning, setIsRescanning] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [localLoaderMessage, setLocalLoaderMessage] = useState<string | null>(null);
    const [isAddPlaylistModalOpen, setIsAddPlaylistModalOpen] = useState(false);

    // -- Handlers --
    const handlePlaylistChangeWrapper = (event: React.ChangeEvent<HTMLSelectElement>) => {
        closeAnyPanelAndResets();
        const newPlaylistId = event.target.value;
        setSelectedPlaylistId(newPlaylistId);
        if (newPlaylistId) {
            fetchTracksForPlaylist(newPlaylistId);
            const playlist = playlists.find(p => p.id === newPlaylistId);
            setCurrentSourceLabel(playlist ? playlist.name : "Selected Playlist");
        } else {
            setCurrentSourceLabel("Select Source");
        }
    };

    const handleExportMap = () => {
        if (isExportingMap) return;
        setIsExportingMap(true);
    };

    const handleRescanUnknowns = React.useCallback(async () => {
        setIsRescanning(true);
        setLocalLoaderMessage("Clearing cache for unknown artists...");

        try {
            const response = await fetch('/api/admin/clear-unknowns', {
                method: 'POST',
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to clear the cache.");
            }

            setStatusMessage({ text: data.message, type: 'success' });

        } catch (error: any) {
            setStatusMessage({ text: `Error: ${error.message}`, type: 'error' });
        } finally {
            setIsRescanning(false);
            setLocalLoaderMessage(null);
            setTimeout(() => setStatusMessage(null), 5000);
        }
    }, []);

    // Derived state
    const isLoadingAnythingNonAuth = isLoadingPlaylists || isLoadingPlaylistTracks;
    const finalLoaderMessage = localLoaderMessage || contextLoaderMessage;



    // Open modal on mount if no playlist is selected and we are not in a "loading" state that might resolve to a playlist
    useEffect(() => {
        // Simple check: if we have no tracks and not loading, prompt user.
        // Or if we just want to force it on landing essentially:
        if (!selectedPlaylistId && !isLoadingAnythingNonAuth) {
            setIsAddPlaylistModalOpen(true);
        }
    }, [selectedPlaylistId, isLoadingAnythingNonAuth]);


    return (
        <div className="flex min-h-screen flex-col bg-nb-bg text-nb-text">
            {finalLoaderMessage && <StatusLoader message={finalLoaderMessage} />}

            <Sidebar
                // Playlist
                playlists={playlists}
                selectedPlaylistId={selectedPlaylistId}
                onPlaylistChange={(id) => {
                    closeAnyPanelAndResets();
                    setSelectedPlaylistId(id);
                    if (id) {
                        fetchTracksForPlaylist(id);
                        const playlist = playlists.find(p => p.id === id);
                        setCurrentSourceLabel(playlist ? playlist.name : "Selected Playlist");
                    } else {
                        setCurrentSourceLabel("Select Source");
                    }
                }}
                onAddPlaylist={() => setIsAddPlaylistModalOpen(true)}
                onDeletePlaylist={deletePlaylist}
                isLoadingPlaylists={isLoadingPlaylists}

                // Timeline
                isTimelineActive={timeline.isTimelineActive}
                onToggleTimeline={() => {
                    const isNowActivating = !timeline.isTimelineActive;
                    timeline.setIsTimelineActive(isNowActivating);
                    timeline.setIsPlaying(isNowActivating);
                    timeline.setTimelineFrame(0);
                    if (isNowActivating) {
                        setIsMultiSelectModeActive(false);
                    }
                }}

                // Multi-select
                isMultiSelectModeActive={isMultiSelectModeActive}
                onToggleMultiSelect={() => setIsMultiSelectModeActive(!isMultiSelectModeActive)}
                multiSelectedCountriesCount={multiSelectedCountries.length}
                onShowMultiCountryDetails={handleShowMultiCountryDetails}

                // Export & Rescan
                isExporting={isExportingMap}
                onExportMap={handleExportMap}
                isRescanning={isRescanning}
                onRescanUnknowns={handleRescanUnknowns}

                // Unknowns
                unknownsCount={unknownsCount}
                onUnknownsClick={() => setIsUnknownsWindowOpen(!isUnknownsWindowOpen)}

                // Share Stats
                totalSongs={currentTracks.length}
                totalCountries={countrySongCounts ? countrySongCounts.size : 0}
                topCountries={countrySongCounts ? Array.from(countrySongCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([iso, count]) => {
                        // Need country names map or just fetch on fly... 
                        // Actually we don't have a direct Iso->Name map exposed easily unless we parse it from somewhere or use generic.
                        // Wait, we can get names if we track them. MapContext uses d3 probably or keeps track?
                        // Actually MapContext handles `artistCountries` map which is Name->Country(ISO).
                        // We need a simple ISO->Name. 
                        // Ideally we'd have a helper. For now let's just use ISO code or try to leverage existing data.
                        // Actually, let's use a standard display name if possible.
                        // For the sake of simplicity in this step, I will pass ISO. 
                        // *Correction*: Users want names. I can use `new Intl.DisplayNames(['en'], { type: 'region' })`.
                        try {
                            const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
                            return { name: regionNames.of(iso) || iso, count };
                        } catch (e) {
                            return { name: iso, count };
                        }
                    }) : []
                }
            />

            <main className="flex flex-grow flex-col md:flex-row md:pl-16 pb-16 md:pb-0 transition-all duration-300">
                <div className="relative flex-grow w-full h-full">

                    {/* Status Toast - Fixed to viewport */}
                    {statusMessage && (
                        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1300] p-3 px-6 text-sm font-semibold rounded-nb border-2 shadow-nb transition-opacity duration-300 ${statusMessage.type === 'success' ? 'bg-nb-accent text-nb-text-on-accent border-nb-border' : 'bg-nb-accent-destructive text-nb-text-on-destructive border-nb-border'}`}>
                            {statusMessage.text}
                        </div>
                    )}

                    {/* Map & Legend */}
                    {/* Map & Legend */}
                    <MapContainer
                        isTimelineActive={timeline.isTimelineActive}
                        timelineMapCounts={timeline.timelineMapCounts}
                        isExportingMap={isExportingMap}
                        onExportComplete={() => setIsExportingMap(false)}
                    />

                    {/* Welcome Overlay */}
                    {(currentTracks.length === 0 && !isLoadingAnythingNonAuth && !finalLoaderMessage) && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 p-4 pointer-events-none">
                            <div className="max-w-md w-full space-y-4 bg-nb-bg/90 backdrop-blur-md p-6 rounded-xl border border-nb-border shadow-nb text-center pointer-events-auto">
                                <h3 className="text-xl font-bold text-nb-text">Welcome to Spotimap!</h3>
                                <p className="text-nb-text/70">Select a saved playlist or add a public playlist to visualize your music journey on the map.</p>
                                <button
                                    onClick={() => setIsAddPlaylistModalOpen(true)}
                                    className="btn btn-accent text-sm px-6 py-2"
                                >
                                    Add Public Playlist
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Controls & Panels */}
                    {(currentTracks.length > 0 && !isLoadingAnythingNonAuth) && (
                        <ControlsContainer
                            timeline={timeline}
                            onExportMap={handleExportMap}
                            isExportingMap={isExportingMap}
                            onRescanUnknowns={handleRescanUnknowns}
                            isRescanning={isRescanning}
                        />
                    )}
                </div>
            </main>

            <AddPlaylistModal
                isOpen={isAddPlaylistModalOpen}
                onClose={() => setIsAddPlaylistModalOpen(false)}
            />

            <Analytics />
            <SpeedInsights />
        </div>
    );
}

export default function HomePage() {
    return (
        <SpotifyProvider>
            <MapProvider>
                <AppLayout />
            </MapProvider>
        </SpotifyProvider>
    );
}