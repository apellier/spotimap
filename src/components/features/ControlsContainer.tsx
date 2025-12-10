"use client";

import React from 'react';
import { useMapContext } from '@/contexts/MapContext';
import CountryDetailsPanel from '@/components/CountryDetailsPanel';
import UnknownsPanel from '@/components/UnknownsPanel';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline'; // For timeline
import { useSpotifyContext } from '@/contexts/SpotifyContext';

interface ControlsContainerProps {
    // Timeline props
    timeline: {
        isTimelineActive: boolean;
        setIsTimelineActive: (active: boolean) => void;
        isPlaying: boolean;
        setIsPlaying: (playing: boolean) => void;
        timelineFrame: number;
        setTimelineFrame: (frame: number) => void;
        timelineSpeed: number;
        handleChangeSpeed: (direction: 'increase' | 'decrease') => void;
        timelineData: any[];
        timelineMapCounts: Map<string, number>;
        minSpeed: number;
        maxSpeed: number;
        baseSpeed: number;
    };
    // Export
    onExportMap: () => void;
    isExportingMap: boolean;
    onRescanUnknowns: () => void;
    isRescanning: boolean;
}

export default function ControlsContainer({
    timeline,
    onExportMap,
    isExportingMap,
    onRescanUnknowns,
    isRescanning
}: ControlsContainerProps) {

    const {
        isSingleCountryPanelOpen,
        isMultiCountryPanelOpen,
        singleCountryDetails,
        multiCountryDisplayData,
        closeAnyPanelAndResets,
        isUnknownsWindowOpen,
        setIsUnknownsWindowOpen,
        unknownsList
    } = useMapContext();

    const { currentTracks, isLoadingPlaylists, isLoadingPlaylistTracks } = useSpotifyContext();

    return (
        <>
            <UnknownsPanel
                isOpen={isUnknownsWindowOpen}
                onClose={() => setIsUnknownsWindowOpen(false)}
                unknownsList={unknownsList}
            />

            <CountryDetailsPanel
                isOpen={isSingleCountryPanelOpen || isMultiCountryPanelOpen}
                onClose={closeAnyPanelAndResets}
                details={isMultiCountryPanelOpen ? multiCountryDisplayData : singleCountryDetails}
            />

            {/* TIMELINE CONTROLS */}
            {timeline.isTimelineActive && timeline.timelineData.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 z-[1100] bg-nb-bg border-t-nb-thick border-nb-border p-4 shadow-nb-accent">
                    <div className="relative flex items-center gap-4 max-w-screen-md mx-auto">
                        <button onClick={() => timeline.setIsPlaying(!timeline.isPlaying)} className="btn btn-icon w-12 h-12 text-xl">
                            {timeline.isPlaying ? '❚❚' : '▶'}
                        </button>
                        <button onClick={() => { timeline.setTimelineFrame(0); timeline.setIsPlaying(false); }} className="btn btn-icon text-xl">
                            ↺
                        </button>
                        <div className="flex-grow text-center">
                            <input
                                type="range"
                                min="0"
                                max={timeline.timelineData.length}
                                value={timeline.timelineFrame}
                                onChange={(e) => {
                                    timeline.setIsPlaying(false);
                                    timeline.setTimelineFrame(Number(e.target.value));
                                }}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                            <div className="text-xs mt-1 text-nb-text/80">
                                {timeline.timelineData[timeline.timelineFrame - 1]?.added_at.toLocaleDateString() || "Start"}
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button onClick={() => timeline.handleChangeSpeed('decrease')} className="btn btn-icon w-8 h-8 flex items-center justify-center p-0" title="Slow down" disabled={timeline.timelineSpeed >= timeline.maxSpeed}>
                                <MinusIcon className="w-4 h-4 stroke-2" />
                            </button>
                            <div className="text-xs font-mono w-12 text-center" title="Animation speed">
                                {(timeline.baseSpeed / timeline.timelineSpeed).toFixed(1)}x
                            </div>
                            <button onClick={() => timeline.handleChangeSpeed('increase')} className="btn btn-icon w-8 h-8 flex items-center justify-center p-0" title="Speed up" disabled={timeline.timelineSpeed <= timeline.minSpeed}>
                                <PlusIcon className="w-4 h-4 stroke-2" />
                            </button>
                        </div>

                        <div className="w-40 text-left text-xs hidden sm:block">
                            <p className="font-bold truncate mb-0">Now Adding:</p>
                            <div className="leading-tight text-nb-text/80">
                                <p className="truncate m-0">{timeline.timelineData[timeline.timelineFrame - 1]?.trackName || "..."}</p>
                                <p className="truncate m-0 font-semibold">{timeline.timelineData[timeline.timelineFrame - 1]?.country || "..."}</p>
                            </div>
                        </div>

                        <button
                            onClick={() => { timeline.setIsTimelineActive(false); timeline.setIsPlaying(false); }}
                            className="btn btn-icon absolute -top-2 -right-2 w-8 h-8 text-2xl flex items-center justify-center"
                            title="Hide Timeline"
                        >
                            &times;
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
