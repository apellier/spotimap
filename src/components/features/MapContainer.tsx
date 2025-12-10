"use client";

import React from 'react';
import { useMapContext } from '@/contexts/MapContext';
import MapComponent from '@/components/MapComponent';
import MapLegend from '@/components/MapLegend';

interface MapContainerProps {
    isTimelineActive: boolean;
    timelineMapCounts: Map<string, number>;
    // Export props can be passed here or managed via context if we want to move export state to context
    isExportingMap: boolean;
    onExportComplete: () => void;
}

export default function MapContainer({
    isTimelineActive,
    timelineMapCounts,
    isExportingMap,
    onExportComplete
}: MapContainerProps) {

    const {
        countrySongCounts,
        handleMapClick,
        multiSelectedCountries,
        legendItems
    } = useMapContext();

    // Calculate highlighting
    const codesToHighlightOnMap = React.useMemo(() => {
        return multiSelectedCountries.length > 0
            ? multiSelectedCountries.map(c => c.isoCode)
            : [];
    }, [multiSelectedCountries]);

    return (
        <>
            <MapComponent
                countrySongCounts={isTimelineActive ? timelineMapCounts : countrySongCounts}
                onCountryClick={handleMapClick}
                selectedIsoCodes={codesToHighlightOnMap}
                isExporting={isExportingMap}
                onExportComplete={onExportComplete}
            />
            {!isTimelineActive && legendItems.length > 0 && <MapLegend legendItems={legendItems} />}
        </>
    );
}
