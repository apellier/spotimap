// src/hooks/useArtistOrigins.ts
import { useState, useCallback, useEffect } from 'react';
import { Track, ArtistInfoFromAPI } from '@/types'; // Centralized types

// Helper from HomePage.tsx (or move to a shared util)
const getUniqueFirstArtistsFromTracks = (tracks: Array<{ track: Track }>): string[] => {
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
    const [unknownsList, setUnknownsList] = useState<Array<{ trackName: string; artistName: string }>>([]);

    const fetchCountriesForArtists = useCallback(async (artistNamesToFetch: string[]) => {
        if (artistNamesToFetch.length === 0) return;
        setIsLoadingArtistCountries(true);
        const newCountriesData = new Map<string, string | null>();
        for (const name of artistNamesToFetch) {
            const nameKey = name.toLowerCase();
            // No client-side pre-check here, this hook owns the artistCountries map
            try {
                const response = await fetch(`/api/musicbrainz/artist-info?artistName=${encodeURIComponent(name)}`);
                if (response.ok) {
                    const data: ArtistInfoFromAPI = await response.json();
                    newCountriesData.set(nameKey, data.country);
                } else { newCountriesData.set(nameKey, null); }
            } catch (error) { newCountriesData.set(nameKey, null); }
        }

        if (newCountriesData.size > 0) {
            setArtistCountries(prev => new Map([...Array.from(prev.entries()), ...Array.from(newCountriesData.entries())]));
        }
        setIsLoadingArtistCountries(false);
    }, []); // No dependencies on component state here

    useEffect(() => {
        // This effect triggers when currentTracks change (new song list loaded)
        setArtistCountries(new Map()); // Reset origins for new track list
        setIsLoadingArtistCountries(false); // Reset loading state
        setUnknownsCount(0);
        setUnknownsList([]);

        if (currentTracks.length > 0) {
            const uniqueFirstArtists = getUniqueFirstArtistsFromTracks(currentTracks);
            if (uniqueFirstArtists.length > 0) {
                fetchCountriesForArtists(uniqueFirstArtists);
            }
        }
    }, [currentTracks, fetchCountriesForArtists]); // Rerun when tracks change

    // Effect to calculate unknowns after artistCountries map is updated
    useEffect(() => {
        if (isLoadingArtistCountries || currentTracks.length === 0) {
            // If still loading origins, or no tracks, or artistCountries not yet populated from current tracks
            if (currentTracks.length === 0) { // If no tracks, reset unknowns
                setUnknownsCount(0);
                setUnknownsList([]);
            }
            return;
        }

        let currentTotalUnknowns = 0;
        const currentUnknownsDetailedList: Array<{ trackName: string; artistName: string }> = [];
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

    return { artistCountries, isLoadingArtistCountries, unknownsCount, unknownsList };
}