// src/hooks/useMapData.ts
import { useState, useEffect, useCallback } from 'react';
import { SpotifyTrack } from '@/types';

export function useMapData(
    currentTracks: Array<{ track: SpotifyTrack }>,
    artistCountries: Map<string, string | null>,
    isLoadingOrigins: boolean // Add this new prop
) {
    const [countrySongCounts, setCountrySongCounts] = useState<Map<string, number>>(new Map());
    const [isAggregating, setIsAggregating] = useState(false);

    const aggregateData = useCallback(() => {
        // Aggregate if we have tracks. Even if loading origins, we might have partial data.
        if (currentTracks.length === 0) {
            setCountrySongCounts(new Map());
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
    }, [currentTracks, artistCountries]); // dependency on isLoadingOrigins removed

    useEffect(() => {
        // Trigger aggregation when tracks or artistCountries change.
        // We do NOT block on isLoadingOrigins anymore to allow incremental visualization.
        aggregateData();
    }, [currentTracks, artistCountries, aggregateData]);

    return { countrySongCounts, isAggregating };
}