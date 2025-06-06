// src/components/MapControlPanel.tsx
"use client";

import React from 'react';
import { ClockIcon, ListBulletIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface MapControlPanelProps {
    isTimelineActive: boolean;
    isMultiSelectModeActive: boolean;
    multiSelectedCountriesCount: number;
    isAnyPanelOpen: boolean;
    onToggleTimeline: () => void;
    onToggleMultiSelect: () => void;
    onShowMultiCountryDetails: () => void;
}

const MapControlPanel: React.FC<MapControlPanelProps> = ({
    isTimelineActive,
    isMultiSelectModeActive,
    multiSelectedCountriesCount,
    isAnyPanelOpen,
    onToggleTimeline,
    onToggleMultiSelect,
    onShowMultiCountryDetails,
}) => {
    // We'll hide the main controls if any details panel is open to reduce clutter
    if (isAnyPanelOpen) {
        return null;
    }

    return (
        <div 
            className="absolute top-[70px] right-nb-md z-[600] p-2 bg-nb-bg border-nb-border border-2 shadow-nb rounded-nb w-52 flex flex-col text-sm space-y-2"
        >
            <h4 className="p-1 text-xs font-bold tracking-widest text-center uppercase border-b-2 border-nb-border">
                CONTROLS
            </h4>
            
            {/* Show EITHER timeline controls OR map selection controls */}
            {isTimelineActive ? (
                <button
                    onClick={onToggleTimeline}
                    className="btn btn-outline text-xs w-full flex items-center justify-start gap-2 p-2"
                >
                    <ClockIcon className="w-4 h-4" /> Hide Timeline
                </button>
            ) : (
                <>
                    <button
                        onClick={onToggleMultiSelect}
                        className={`btn text-xs w-full flex items-center justify-start gap-2 p-2 ${isMultiSelectModeActive ? 'btn-accent' : 'btn-outline'}`}
                    >
                        <ListBulletIcon className="w-4 h-4" /> {isMultiSelectModeActive ? 'Cancel Select' : 'Select Multiple'}
                    </button>

                    {multiSelectedCountriesCount > 0 && (
                        <button
                            onClick={onShowMultiCountryDetails}
                            className="btn btn-accent text-xs w-full flex items-center justify-start gap-2 p-2"
                        >
                            <MagnifyingGlassIcon className="w-4 h-4" /> View {multiSelectedCountriesCount} Countries
                        </button>
                    )}
                    
                    <hr className="border-nb-border/30 my-1" />

                    <button 
                        onClick={onToggleTimeline}
                        className="btn btn-outline text-xs w-full flex items-center justify-start gap-2 p-2"
                    >
                        <ClockIcon className="w-4 h-4" /> Show Geo-Timeline
                    </button>
                </>
            )}
        </div>
    );
};

export default MapControlPanel;