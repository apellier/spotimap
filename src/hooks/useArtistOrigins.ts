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
            setTotalUniqueArtistsInCurrentSet(0);
            return;
        }
        setIsLoadingArtistCountries(true);
        setProcessedArtistCountForLoader(0); // Reset progress count at the beginning of fetching a new set
        setTotalUniqueArtistsInCurrentSet(artistNamesToFetch.length);

        const newArtistCountriesMap = new Map<string, string | null>();
        let artistsSuccessfullyFetchedFromCache: string[] = [];
        let artistsToFetchFromMusicBrainz: string[] = [...artistNamesToFetch];

        // Phase 1: Batch fetch from DB cache
        try {
            const batchResponse = await fetch('/api/musicbrainz/batch-artist-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artistNames: artistNamesToFetch })
            });

            if (batchResponse.ok) {
                const cachedData: Record<string, { country: string | null; mbid: string | null; nameFound: string | null; }> = await batchResponse.json();
                artistsSuccessfullyFetchedFromCache = [];
                
                artistNamesToFetch.forEach(name => {
                    const nameKey = name.toLowerCase();
                    if (cachedData[nameKey]) {
                        newArtistCountriesMap.set(nameKey, cachedData[nameKey].country);
                        artistsSuccessfullyFetchedFromCache.push(name);
                    }
                });

                // Update loader count after batch operation
                setProcessedArtistCountForLoader(artistsSuccessfullyFetchedFromCache.length);

                // Determine artists still needing fetch (not found in cache or stale)
                artistsToFetchFromMusicBrainz = artistNamesToFetch.filter(
                    name => !artistsSuccessfullyFetchedFromCache.find(cachedName => cachedName.toLowerCase() === name.toLowerCase())
                );

            } else {
                console.warn(`Batch artist info fetch failed (${batchResponse.status}), falling back to individual fetches for all.`);
                // artistsToFetchFromMusicBrainz remains the full list
            }
        } catch (e) {
            console.error("Error in batch artist info fetch:", e);
            // artistsToFetchFromMusicBrainz remains the full list on error
        }
        
        // Phase 2: Fetch remaining artists individually from MusicBrainz
        if (artistsToFetchFromMusicBrainz.length > 0) {
            let individualFetchesProcessed = 0;
            for (const name of artistsToFetchFromMusicBrainz) {
                const nameKey = name.toLowerCase();
                // Avoid re-fetching if somehow already processed (shouldn't happen with above logic but as a safeguard)
                if (newArtistCountriesMap.has(nameKey)) {
                    individualFetchesProcessed++;
                    setProcessedArtistCountForLoader(artistsSuccessfullyFetchedFromCache.length + individualFetchesProcessed);
                    continue;
                }

                try {
                    const response = await fetch(`/api/musicbrainz/artist-info?artistName=${encodeURIComponent(name)}`);
                    if (response.ok) {
                        const data: ArtistInfoFromAPI = await response.json();
                        newArtistCountriesMap.set(nameKey, data.country);
                    } else {
                        console.warn(`Failed to fetch MusicBrainz info for ${name} (fallback): ${response.status}`);
                        newArtistCountriesMap.set(nameKey, null); // Explicitly mark as processed with no country
                    }
                } catch (error) {
                    console.error(`Error fetching MusicBrainz info for ${name} (fallback):`, error);
                    newArtistCountriesMap.set(nameKey, null); // Explicitly mark as processed with no country
                }
                individualFetchesProcessed++;
                setProcessedArtistCountForLoader(artistsSuccessfullyFetchedFromCache.length + individualFetchesProcessed);
            }
        }

        setArtistCountries(newArtistCountriesMap);
        setIsLoadingArtistCountries(false);
    }, []);

    useEffect(() => {
        // This effect triggers when currentTracks change
        setArtistCountries(new Map()); // Reset origins for new track list
        setUnknownsCount(0);
        setUnknownsList([]);
        setProcessedArtistCountForLoader(0); // Reset loader progress count

        if (currentTracks.length > 0) {
            const uniqueFirstArtists = getUniqueFirstArtistsFromTracks(currentTracks);
            if (uniqueFirstArtists.length > 0) {
                fetchCountriesForArtists(uniqueFirstArtists);
            } else {
                setIsLoadingArtistCountries(false); // No artists to fetch
                 setTotalUniqueArtistsInCurrentSet(0); // Ensure total is also zero
            }
        } else {
            setTotalUniqueArtistsInCurrentSet(0);
            setIsLoadingArtistCountries(false); // No tracks, so no loading
            setArtistCountries(new Map());
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