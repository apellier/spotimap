// src/hooks/useMapData.ts
import { useState, useEffect, useCallback } from 'react';
import { Track } from '@/types';

export function useMapData(
    currentTracks: Array<{ track: Track }>,
    artistCountries: Map<string, string | null>,
    isLoadingOrigins: boolean // Add this new prop
) {
    const [countrySongCounts, setCountrySongCounts] = useState<Map<string, number>>(new Map());
    const [isAggregating, setIsAggregating] = useState(false);

    const aggregateData = useCallback(() => {
        // Only aggregate if origins are NOT loading and we have tracks and artistCountries
        if (isLoadingOrigins || currentTracks.length === 0 || artistCountries.size === 0) {
            if (!isLoadingOrigins && currentTracks.length === 0) { // Clear if no tracks and not loading origins
                setCountrySongCounts(new Map());
            }
            setIsAggregating(false);
            return;
        }

        setIsAggregating(true);
        const newCounts = new Map<string, number>();
        currentTracks.forEach(item => {
            if (item.track?.artists && item.track.artists.length > 0) {
                const firstArtist = item.track.artists[0];
                if (firstArtist?.name) {
                    const countryCode = artistCountries.get(firstArtist.name.toLowerCase());
                    if (countryCode) {
                        newCounts.set(countryCode, (newCounts.get(countryCode) || 0) + 1);
                    }
                }
            }
        });
        setCountrySongCounts(newCounts);
        setIsAggregating(false);
    }, [currentTracks, artistCountries, isLoadingOrigins]); // Added isLoadingOrigins

    useEffect(() => {
        // Trigger aggregation only when isLoadingOrigins is false,
        // or when currentTracks or artistCountries change *while not loading origins*.
        if (!isLoadingOrigins) {
            aggregateData();
        } else if (currentTracks.length === 0) { // If tracks are cleared while still theoretically loading origins elsewhere
            setCountrySongCounts(new Map());
            setIsAggregating(false);
        }
        // If isLoadingOrigins is true, we wait for it to become false before re-aggregating.
        // The aggregateData function itself also checks isLoadingOrigins.
    }, [currentTracks, artistCountries, isLoadingOrigins, aggregateData]);

    return { countrySongCounts, isAggregating };
}