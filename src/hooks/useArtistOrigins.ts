// src/hooks/useArtistOrigins.ts
import { useState, useCallback, useEffect } from 'react';
import { Track, ArtistInfoFromAPI, UnknownsListItem } from '@/types'; //

const getUniqueFirstArtistsFromTracks = (tracks: Array<{ track: Track }>): string[] => { //
    const firstArtists = new Set<string>();
    tracks.forEach(item => {
        if (item.track?.artists && item.track.artists.length > 0) {
            const firstArtist = item.track.artists[0];
            if (firstArtist?.name) firstArtists.add(firstArtist.name);
        }
    });
    return Array.from(firstArtists);
};

export function useArtistOrigins(currentTracks: Array<{track: Track}>) {
    const [artistCountries, setArtistCountries] = useState<Map<string, string | null>>(new Map());
    const [isLoadingArtistCountries, setIsLoadingArtistCountries] = useState(false);
    const [unknownsCount, setUnknownsCount] = useState(0);
    const [unknownsList, setUnknownsList] = useState<UnknownsListItem[]>([]);
    const [totalUniqueArtistsInCurrentSet, setTotalUniqueArtistsInCurrentSet] = useState(0);
    const [processedArtistCountForLoader, setProcessedArtistCountForLoader] = useState(0); // New state for loader progress

    const fetchCountriesForArtists = useCallback(async (artistNamesToFetch: string[]) => {
        if (artistNamesToFetch.length === 0) {
            setArtistCountries(new Map()); // Ensure map is cleared if no artists
            setIsLoadingArtistCountries(false);
            setProcessedArtistCountForLoader(0);
            return;
        }
        setIsLoadingArtistCountries(true);
        setProcessedArtistCountForLoader(0); // Reset progress count at the beginning of fetching a new set
        const localArtistCountries = new Map<string, string | null>();
        let currentProcessedCount = 0;

        for (const name of artistNamesToFetch) {
            const nameKey = name.toLowerCase(); // Used for map keys
            try {
                // The API route /api/musicbrainz/artist-info already includes a delay.
                const response = await fetch(`/api/musicbrainz/artist-info?artistName=${encodeURIComponent(name)}`); //
                if (response.ok) {
                    const data: ArtistInfoFromAPI = await response.json();
                    localArtistCountries.set(nameKey, data.country);
                } else {
                    console.warn(`Failed to fetch MusicBrainz info for ${name}: ${response.status}`);
                    localArtistCountries.set(nameKey, null);
                }
            } catch (error) {
                console.error(`Error fetching MusicBrainz info for ${name}:`, error);
                localArtistCountries.set(nameKey, null); // Store null on error to mark as processed
            }
            currentProcessedCount++;
            setProcessedArtistCountForLoader(currentProcessedCount); // Update progress for loader
        }
        setArtistCountries(localArtistCountries); // Single state update after all fetches in the batch
        setIsLoadingArtistCountries(false);
    }, []);

    useEffect(() => {
        // This effect triggers when currentTracks change
        setArtistCountries(new Map()); // Reset origins for new track list
        setIsLoadingArtistCountries(false);
        setUnknownsCount(0);
        setUnknownsList([]);
        setProcessedArtistCountForLoader(0); // Reset loader progress count

        if (currentTracks.length > 0) {
            const uniqueFirstArtists = getUniqueFirstArtistsFromTracks(currentTracks);
            setTotalUniqueArtistsInCurrentSet(uniqueFirstArtists.length);
            if (uniqueFirstArtists.length > 0) {
                fetchCountriesForArtists(uniqueFirstArtists);
            } else {
                setIsLoadingArtistCountries(false); // No artists to fetch
                 setTotalUniqueArtistsInCurrentSet(0); // Ensure total is also zero
            }
        } else {
            setTotalUniqueArtistsInCurrentSet(0);
            setIsLoadingArtistCountries(false); // No tracks, so no loading
        }
    }, [currentTracks, fetchCountriesForArtists]);

    // Effect to calculate unknowns after artistCountries map is populated
    useEffect(() => {
        if (isLoadingArtistCountries || currentTracks.length === 0) {
            if (currentTracks.length === 0 && !isLoadingArtistCountries) { // Clear if no tracks and not loading
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
                    if (artistCountries.has(artistKey) && artistCountries.get(artistKey) === null) {
                        if (!uniqueArtistsProcessedForUnknowns.has(firstArtist.name)) {
                            currentTotalUnknowns++;
                            uniqueArtistsProcessedForUnknowns.add(firstArtist.name);
                        }
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
        totalUniqueArtistsInCurrentSet,
        processedArtistCountForLoader // Expose the new progress count
    };
}