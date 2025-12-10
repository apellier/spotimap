"use client";

import React, { useState } from "react";
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

            <main className="flex flex-grow ml-16">
                <div className="relative flex-grow">

                    {/* Status Toast */}
                    {statusMessage && (
                        <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-[1200] p-2 px-4 text-sm font-semibold rounded-nb border-2 shadow-nb transition-opacity duration-300 ${statusMessage.type === 'success' ? 'bg-nb-accent text-nb-text-on-accent border-nb-border' : 'bg-nb-accent-destructive text-nb-text-on-destructive border-nb-border'}`}>
                            {statusMessage.text}
                        </div>
                    )}

                    {/* Map & Legend */}
                    {(currentTracks.length > 0 || isLoadingAnythingNonAuth) ? (
                        <MapContainer
                            isTimelineActive={timeline.isTimelineActive}
                            timelineMapCounts={timeline.timelineMapCounts}
                            isExportingMap={isExportingMap}
                            onExportComplete={() => setIsExportingMap(false)}
                        />
                    ) : (
                        !finalLoaderMessage && (
                            <div className="flex h-full w-full items-center justify-center border-nb-thick border-dashed border-nb-border/50 p-nb-lg text-center text-nb-text/70">
                                <p>Select a saved playlist or add a public playlist to visualize!</p>
                            </div>
                        )
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