// src/hooks/useMapData.ts
import { useState, useEffect, useCallback } from 'react';
import { Track, LegendItem } from '@/types'; // LegendItem might not be needed here anymore
// import { getCountryColor } from '@/utils/mapUtils'; // No longer needed here

export function useMapData(
    currentTracks: Array<{ track: Track }>,
    artistCountries: Map<string, string | null>
) {
    const [countrySongCounts, setCountrySongCounts] = useState<Map<string, number>>(new Map());
    const [isAggregating, setIsAggregating] = useState(false);

    const aggregateData = useCallback(() => {
        setIsAggregating(true);
        const newCounts = new Map<string, number>();
        if (currentTracks.length === 0 || artistCountries.size === 0) {
            setCountrySongCounts(new Map()); // Clear counts if no tracks or no artist countries
            setIsAggregating(false);
            return;
        }
        currentTracks.forEach(item => {
            if (item.track?.artists && item.track.artists.length > 0) {
                const firstArtist = item.track.artists[0];
                if (firstArtist?.name) {
                    // Ensure artist name is looked up in lowercase, consistent with how it's stored in artistCountries
                    const countryCode = artistCountries.get(firstArtist.name.toLowerCase());
                    if (countryCode) { // Ensure countryCode is not null or undefined
                        newCounts.set(countryCode, (newCounts.get(countryCode) || 0) + 1);
                    }
                }
            }
        });
        setCountrySongCounts(newCounts);
        setIsAggregating(false);
    }, [currentTracks, artistCountries]);

    useEffect(() => {
        // Only aggregate if artistCountries has potentially been populated for the currentTracks
        // or if currentTracks is empty (to clear counts).
        if (currentTracks.length === 0) {
            setCountrySongCounts(new Map()); // Clear counts if no tracks
            setIsAggregating(false); // Ensure loading state is reset
        } else if (artistCountries.size > 0 || currentTracks.some(t => t.track?.artists?.[0]?.name && artistCountries.has(t.track.artists[0].name.toLowerCase()))) {
            // Aggregate if artistCountries is populated or if there's a chance it will be for current tracks.
            // This condition might need refinement based on when artistCountries is guaranteed to be populated relative to currentTracks.
            // A simpler approach might be to always call aggregateData and let it handle empty states.
            aggregateData();
        }
        // If currentTracks has items but artistCountries is empty and not expected to populate further for these tracks,
        // counts might remain empty, which is correct.
    }, [currentTracks, artistCountries, aggregateData]);

    // Removed the useEffect block for legendItems as it's handled in HomePage.tsx

    return { countrySongCounts, isAggregating }; // Only return what this hook is responsible for
}
