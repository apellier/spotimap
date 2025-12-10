// src/hooks/useArtistOrigins.ts
import { useState, useCallback, useEffect } from 'react';
import { SpotifyTrack, ArtistInfoFromAPI, UnknownsListItem } from '@/types'; //

const getUniqueFirstArtistsFromTracks = (tracks: Array<{ track: SpotifyTrack }>): string[] => { //
    const firstArtists = new Set<string>();
    tracks.forEach(item => {
        if (item.track?.artists && item.track.artists.length > 0) {
            const firstArtist = item.track.artists[0];
            if (firstArtist?.name) firstArtists.add(firstArtist.name);
        }
    });
    return Array.from(firstArtists);
};

export function useArtistOrigins(currentTracks: Array<{ track: SpotifyTrack }>) {
    const [artistCountries, setArtistCountries] = useState<Map<string, string | null>>(new Map());
    const [isLoadingArtistCountries, setIsLoadingArtistCountries] = useState(false);
    const [unknownsCount, setUnknownsCount] = useState(0);
    const [unknownsList, setUnknownsList] = useState<UnknownsListItem[]>([]);
    const [totalUniqueArtistsInCurrentSet, setTotalUniqueArtistsInCurrentSet] = useState(0);
    const [processedArtistCountForLoader, setProcessedArtistCountForLoader] = useState(0); // New state for loader progress

    const fetchCountriesForArtists = useCallback(async (artistNamesToFetch: string[]) => {
        if (artistNamesToFetch.length === 0) {
            setArtistCountries(new Map());
            setIsLoadingArtistCountries(false);
            setProcessedArtistCountForLoader(0);
            setTotalUniqueArtistsInCurrentSet(0);
            return;
        }
        setIsLoadingArtistCountries(true);
        setProcessedArtistCountForLoader(0);
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

                artistNamesToFetch.forEach(name => {
                    const nameKey = name.toLowerCase();
                    if (cachedData[nameKey]) {
                        newArtistCountriesMap.set(nameKey, cachedData[nameKey].country);
                        artistsSuccessfullyFetchedFromCache.push(name);
                    }
                });

                // Update loader count
                setProcessedArtistCountForLoader(artistsSuccessfullyFetchedFromCache.length);

                // Update state immediately if we have cached results
                if (newArtistCountriesMap.size > 0) {
                    setArtistCountries(new Map(newArtistCountriesMap));
                }

                // Filter out found artists
                artistsToFetchFromMusicBrainz = artistNamesToFetch.filter(
                    name => !artistsSuccessfullyFetchedFromCache.some(cachedName => cachedName.toLowerCase() === name.toLowerCase())
                );

            } else {
                console.warn(`Batch artist info fetch failed (${batchResponse.status}), falling back to individual fetches for all.`);
            }
        } catch (e) {
            console.error("Error in batch artist info fetch:", e);
        }

        // Phase 2: Fetch remaining artists individually from MusicBrainz
        if (artistsToFetchFromMusicBrainz.length > 0) {
            let individualFetchesProcessed = 0;

            const updateStateIncrementally = () => {
                setArtistCountries(new Map(newArtistCountriesMap));
            };

            for (const [index, name] of artistsToFetchFromMusicBrainz.entries()) {
                const nameKey = name.toLowerCase();
                // Check if somehow already present (safeguard)
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
                        newArtistCountriesMap.set(nameKey, null);
                    }
                } catch (error) {
                    console.error(`Error fetching MusicBrainz info for ${name}:`, error);
                    newArtistCountriesMap.set(nameKey, null);
                }
                individualFetchesProcessed++;
                setProcessedArtistCountForLoader(artistsSuccessfullyFetchedFromCache.length + individualFetchesProcessed);

                // Incremental update every 3 items or at end
                if (individualFetchesProcessed % 3 === 0 || index === artistsToFetchFromMusicBrainz.length - 1) {
                    updateStateIncrementally();
                }
            }
        } else {
            // Ensure final state is set if no fallback needed (and if not set by Phase 1)
            if (newArtistCountriesMap.size > 0) {
                setArtistCountries(new Map(newArtistCountriesMap));
            }
        }

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
        setUnknownsList(currentUnknownsDetailedList.sort((a, b) => a.artistName.localeCompare(b.artistName) || a.trackName.localeCompare(b.trackName)));

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