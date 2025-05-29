// src/hooks/useMapData.ts
import { useState, useEffect, useCallback } from 'react';
import { Track } from '@/types';
import { getCountryColor } from '@/utils/mapUtils'; // Assuming mapUtils.ts

export function useMapData(
    currentTracks: Array<{ track: Track }>,
    artistCountries: Map<string, string | null>
) {
    const [countrySongCounts, setCountrySongCounts] = useState<Map<string, number>>(new Map());
    const [legendItems, setLegendItems] = useState<Array<{ color: string; label: string }>>([]);
    const [isAggregating, setIsAggregating] = useState(false); // Add this if needed

    const aggregateData = useCallback(() => {
        setIsAggregating(true);
        const newCounts = new Map<string, number>();
        if (currentTracks.length === 0 || artistCountries.size === 0) {
            setCountrySongCounts(new Map());
            setIsAggregating(false);
            return;
        }
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
    }, [currentTracks, artistCountries]);

    useEffect(() => {
        // Only aggregate if artistCountries has potentially been populated for the currentTracks
        if (currentTracks.length > 0 && artistCountries.size > 0) { // Or a more robust check
            aggregateData();
        } else if (currentTracks.length === 0) {
            setCountrySongCounts(new Map()); // Clear if no tracks
        }
    }, [currentTracks, artistCountries, aggregateData]);


    useEffect(() => { // For Legend Items
        const maxCount = Math.max(...Array.from(countrySongCounts.values()), 1);
        // ... (your legend generation logic from HomePage.tsx, using getCountryColor) ...
        // Example:
        const items = [ /* ... your legend items logic ... */ ];
        setLegendItems(items);
    }, [countrySongCounts, getCountryColor]); // Add getCountryColor if it's not a static import

    return { countrySongCounts, legendItems, isAggregating };
}