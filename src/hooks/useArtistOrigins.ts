// src/hooks/useArtistOrigins.ts
import { useState, useCallback, useEffect } from 'react';
import { Track, ArtistInfoFromAPI, UnknownsListItem } from '@/types'; // Added UnknownsListItem

// Helper from HomePage.tsx (or move to a shared util if not already)
const getUniqueFirstArtistsFromTracks = (tracks: Array<{ track: Track }>): string[] => {
    const firstArtists = new Set<string>();
    tracks.forEach(item => {
        if (item.track?.artists && item.track.artists.length > 0) {
            const firstArtist = item.track.artists[0];
            if (firstArtist?.name) firstArtists.add(firstArtist.name); // Keep original case for fetching, lowercase for map keys
        }
    });
    return Array.from(firstArtists);
};

export function useArtistOrigins(currentTracks: Array<{track: Track}>) {
    const [artistCountries, setArtistCountries] = useState<Map<string, string | null>>(new Map());
    const [isLoadingArtistCountries, setIsLoadingArtistCountries] = useState(false);
    const [unknownsCount, setUnknownsCount] = useState(0);
    const [unknownsList, setUnknownsList] = useState<UnknownsListItem[]>([]); // Use UnknownsListItem
    const [totalUniqueArtistsInCurrentSet, setTotalUniqueArtistsInCurrentSet] = useState(0);


    const fetchCountriesForArtists = useCallback(async (artistNamesToFetch: string[]) => {
        if (artistNamesToFetch.length === 0) {
            setIsLoadingArtistCountries(false); // Ensure loading state is reset
            return;
        }
        setIsLoadingArtistCountries(true);
        // No longer collect in newCountriesData and update at the end for incremental updates

        for (const name of artistNamesToFetch) {
            const nameKey = name.toLowerCase(); // Use lowercase for map keys

            // Optional: If you want to avoid re-fetching for an artist already in the map
            // from a previous incomplete run (though full reset on currentTracks change is typical)
            // if (artistCountries.has(nameKey)) {
            //     continue;
            // }

            try {
                const response = await fetch(`/api/musicbrainz/artist-info?artistName=${encodeURIComponent(name)}`);
                // await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay for testing progress

                if (response.ok) {
                    const data: ArtistInfoFromAPI = await response.json();
                    setArtistCountries(prev => new Map(prev).set(nameKey, data.country));
                } else {
                    console.warn(`Failed to fetch MusicBrainz info for ${name}: ${response.status}`);
                    setArtistCountries(prev => new Map(prev).set(nameKey, null));
                }
            } catch (error) {
                console.error(`Error fetching MusicBrainz info for ${name}:`, error);
                setArtistCountries(prev => new Map(prev).set(nameKey, null)); // Store null on error to mark as processed
            }
        }
        // All artists in the current batch processed
        setIsLoadingArtistCountries(false);
    }, []); // Empty dependency array: function logic doesn't depend on hook's state changes directly

    useEffect(() => {
        // This effect triggers when currentTracks change
        setArtistCountries(new Map()); // Reset origins for new track list
        setIsLoadingArtistCountries(false); // Reset loading state initially
        setUnknownsCount(0);
        setUnknownsList([]);

        if (currentTracks.length > 0) {
            const uniqueFirstArtists = getUniqueFirstArtistsFromTracks(currentTracks);
            setTotalUniqueArtistsInCurrentSet(uniqueFirstArtists.length); // Set total for progress display
            if (uniqueFirstArtists.length > 0) {
                fetchCountriesForArtists(uniqueFirstArtists);
            } else {
                setIsLoadingArtistCountries(false); // No artists to fetch
            }
        } else {
            setTotalUniqueArtistsInCurrentSet(0);
            setIsLoadingArtistCountries(false); // No tracks, so no loading
        }
    }, [currentTracks, fetchCountriesForArtists]);

    // Effect to calculate unknowns after artistCountries map is updated
    useEffect(() => {
        if (isLoadingArtistCountries || currentTracks.length === 0) {
            if (currentTracks.length === 0) {
                setUnknownsCount(0);
                setUnknownsList([]);
            }
            return;
        }

        let currentTotalUnknowns = 0;
        const currentUnknownsDetailedList: UnknownsListItem[] = [];
        const uniqueArtistsProcessedForUnknowns = new Set<string>();

        currentTracks.forEach(item => {
            if (item.track?.artists && item.track.artists.length > 0) {
                const firstArtist = item.track.artists[0];
                if (firstArtist?.name) {
                    const artistKey = firstArtist.name.toLowerCase();
                    // Check if the artist has been processed (i.e., is a key in artistCountries)
                    // and if their country is null (meaning unknown or fetch failed)
                    if (artistCountries.has(artistKey) && artistCountries.get(artistKey) === null) {
                        // Count unique artists for unknownsCount
                        if (!uniqueArtistsProcessedForUnknowns.has(firstArtist.name)) {
                            currentTotalUnknowns++;
                            uniqueArtistsProcessedForUnknowns.add(firstArtist.name);
                        }
                        // Add all tracks by this unknown artist to the detailed list
                        currentUnknownsDetailedList.push({ trackName: item.track.name, artistName: firstArtist.name });
                    }
                }
            }
        });
        setUnknownsCount(currentTotalUnknowns);
        setUnknownsList(currentUnknownsDetailedList.sort((a,b) => a.artistName.localeCompare(b.artistName) || a.trackName.localeCompare(b.trackName) ));

    }, [currentTracks, artistCountries, isLoadingArtistCountries]);

    return { 
        artistCountries, 
        isLoadingArtistCountries, 
        unknownsCount, 
        unknownsList,
        totalUniqueArtistsInCurrentSet // Expose this for the loader in page.tsx
    };
}