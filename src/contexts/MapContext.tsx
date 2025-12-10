"use client";

import React, { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react';
import { useSpotifyContext } from './SpotifyContext';
import { useArtistOrigins } from '@/hooks/useArtistOrigins';
import { useMapData } from '@/hooks/useMapData';
import { SelectedCountryInfo, SelectedCountryBasicInfo, ArtistDetail, MultiCountryDisplayInfo, LegendItem } from '@/types';
import * as d3 from 'd3';
import { getCountryColor } from '@/utils/mapUtils'; // Ensure this exists or move logic

interface MapContextType {
    // Artist & Country Data
    artistCountries: Map<string, string>;
    isLoadingArtistCountries: boolean;
    unknownsCount: number;
    unknownsList: any[]; // refine type
    totalUniqueArtistsInCurrentSet: number;
    processedArtistCountForLoader: number;

    // Aggregated Map Data
    countrySongCounts: Map<string, number>;
    isAggregating: boolean;
    legendItems: LegendItem[];

    // Selection State
    singleCountryDetails: SelectedCountryInfo | null;
    setSingleCountryDetails: (details: SelectedCountryInfo | null) => void;
    isSingleCountryPanelOpen: boolean;
    setIsSingleCountryPanelOpen: (isOpen: boolean) => void;

    multiSelectedCountries: SelectedCountryBasicInfo[];
    setMultiSelectedCountries: React.Dispatch<React.SetStateAction<SelectedCountryBasicInfo[]>>;

    multiCountryDisplayData: MultiCountryDisplayInfo | null;
    setMultiCountryDisplayData: (data: MultiCountryDisplayInfo | null) => void;
    isMultiCountryPanelOpen: boolean;
    setIsMultiCountryPanelOpen: (isOpen: boolean) => void;

    isMultiSelectModeActive: boolean;
    setIsMultiSelectModeActive: (isActive: boolean) => void;

    // Unknowns
    isUnknownsWindowOpen: boolean;
    setIsUnknownsWindowOpen: (isOpen: boolean) => void;

    // Actions
    handleMapClick: (isoCode: string, countryName: string, isShiftKey: boolean) => void;
    handleShowMultiCountryDetails: () => void;
    closeAnyPanelAndResets: () => void;

    // Loaders
    loaderMessage: string | null;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export function MapProvider({ children }: { children: ReactNode }) {
    const { currentTracks, isLoadingLikedSongs, isLoadingPlaylists, isLoadingPlaylistTracks, playlists, selectedPlaylistId, authStatus, session } = useSpotifyContext();

    const {
        artistCountries, isLoadingArtistCountries, unknownsCount, unknownsList,
        totalUniqueArtistsInCurrentSet, processedArtistCountForLoader
    } = useArtistOrigins(currentTracks);

    const { countrySongCounts, isAggregating } = useMapData(currentTracks, artistCountries, isLoadingArtistCountries);

    // --- LOCAL STATE ---
    const [singleCountryDetails, setSingleCountryDetails] = useState<SelectedCountryInfo | null>(null);
    const [isSingleCountryPanelOpen, setIsSingleCountryPanelOpen] = useState(false);
    const [multiSelectedCountries, setMultiSelectedCountries] = useState<SelectedCountryBasicInfo[]>([]);
    const [multiCountryDisplayData, setMultiCountryDisplayData] = useState<MultiCountryDisplayInfo | null>(null);
    const [isMultiCountryPanelOpen, setIsMultiCountryPanelOpen] = useState(false);
    const [isUnknownsWindowOpen, setIsUnknownsWindowOpen] = useState(false);
    const [isMultiSelectModeActive, setIsMultiSelectModeActive] = useState(false);
    const [legendItems, setLegendItems] = useState<LegendItem[]>([]);

    const closeAnyPanelAndResets = useCallback(() => {
        setIsSingleCountryPanelOpen(false);
        setSingleCountryDetails(null);
        setIsMultiCountryPanelOpen(false);
        setMultiCountryDisplayData(null);
        setMultiSelectedCountries([]);
    }, []);

    // --- LOGIC MOVED FROM PAGE.TSX ---

    // Map Click Handler
    const handleMapClick = useCallback((isoCode: string, countryName: string, isShiftKey: boolean) => {
        if (isMultiSelectModeActive || isShiftKey) {
            setMultiSelectedCountries(prevSelected => {
                const existingIndex = prevSelected.findIndex(c => c.isoCode === isoCode);
                if (existingIndex > -1) {
                    return prevSelected.filter(c => c.isoCode !== isoCode);
                } else {
                    return [...prevSelected, { isoCode, name: countryName }];
                }
            });
            // Prepare UI for multi-select (close single panel if open)
            if (isSingleCountryPanelOpen) {
                setIsSingleCountryPanelOpen(false);
                setSingleCountryDetails(null);
            }
            setIsMultiCountryPanelOpen(false);
        } else {
            // Single select mode
            setMultiSelectedCountries([]);
            setIsMultiCountryPanelOpen(false);
            setMultiCountryDisplayData(null);

            const M_songCount = countrySongCounts.get(isoCode.toUpperCase()) || 0;
            const M_artistsFromCountry: ArtistDetail[] = [];

            if (M_songCount > 0) {
                currentTracks.forEach(item => {
                    if (item.track?.artists?.[0]?.name) {
                        const firstArtist = item.track.artists[0];
                        const artistCountry = artistCountries.get(firstArtist.name.toLowerCase());
                        if (artistCountry?.toUpperCase() === isoCode.toUpperCase()) {
                            let M_existingArtist = M_artistsFromCountry.find(a => a.name === firstArtist.name);
                            if (!M_existingArtist) {
                                M_existingArtist = { name: firstArtist.name, songs: [] };
                                M_artistsFromCountry.push(M_existingArtist);
                            }
                            if (item.track && !M_existingArtist.songs.some(s => s.id === item.track.id)) {
                                M_existingArtist.songs.push({ id: item.track.id, name: item.track.name });
                            }
                        }
                    }
                });
            }

            M_artistsFromCountry.sort((a, b) => a.name.localeCompare(b.name)).forEach(a => a.songs.sort((s1, s2) => s1.name.localeCompare(s2.name)));

            setSingleCountryDetails({ isoCode, name: countryName, songCount: M_songCount, artists: M_artistsFromCountry });
            setIsSingleCountryPanelOpen(true);
        }
    }, [isMultiSelectModeActive, isSingleCountryPanelOpen, countrySongCounts, currentTracks, artistCountries]);

    // Show Multi Country Details
    const handleShowMultiCountryDetails = useCallback(() => {
        if (multiSelectedCountries.length > 0) {
            const countryInfoForPanel: Array<SelectedCountryBasicInfo & { songCount: number }> = [];
            let MtotalSongCount = 0;
            const MartistsMap = new Map<string, ArtistDetail>();
            const MallTrackUris = new Set<string>();

            multiSelectedCountries.forEach(country => {
                const upperIsoCode = country.isoCode.toUpperCase();
                const count = countrySongCounts.get(upperIsoCode) || 0;
                countryInfoForPanel.push({ ...country, songCount: count });
                MtotalSongCount += count;

                currentTracks.forEach(item => {
                    if (item.track?.artists?.[0]?.name) {
                        const firstArtist = item.track.artists[0];
                        const artistOriginCountry = artistCountries.get(firstArtist.name.toLowerCase());
                        if (artistOriginCountry?.toUpperCase() === upperIsoCode) {
                            if (item.track.uri) MallTrackUris.add(item.track.uri);
                            let M_existingArtist = MartistsMap.get(firstArtist.name);
                            if (!M_existingArtist) {
                                M_existingArtist = { name: firstArtist.name, songs: [] };
                                MartistsMap.set(firstArtist.name, M_existingArtist);
                            }
                            if (item.track && !M_existingArtist.songs.some(s => s.id === item.track.id)) {
                                M_existingArtist.songs.push({ id: item.track.id, name: item.track.name });
                            }
                        }
                    }
                });
            });
            const M_finalArtists = Array.from(MartistsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
            M_finalArtists.forEach(a => a.songs.sort((s1, s2) => s1.name.localeCompare(s2.name)));

            setMultiCountryDisplayData({
                countries: countryInfoForPanel.sort((a, b) => a.name.localeCompare(b.name)),
                totalSongCount: MtotalSongCount,
                artists: M_finalArtists,
                allTrackUris: Array.from(MallTrackUris)
            });
            setIsMultiCountryPanelOpen(true);
            setIsSingleCountryPanelOpen(false);
            setSingleCountryDetails(null);
        }
    }, [multiSelectedCountries, countrySongCounts, currentTracks, artistCountries]);


    // Legend Logic (Ported from page.tsx)
    React.useEffect(() => {
        if (countrySongCounts.size === 0 && Array.from(countrySongCounts.values()).every(c => c === 0) && currentTracks.length > 0 && !isLoadingArtistCountries && !isAggregating) {
            const maxCountForLegend = Math.max(...Array.from(countrySongCounts.values()), 0);
            setLegendItems([{ color: getCountryColor(0, maxCountForLegend), label: "0 songs" }]);
            return;
        }
        if (countrySongCounts.size === 0 && currentTracks.length === 0 && !isLoadingArtistCountries && !isAggregating) {
            setLegendItems([]);
            return;
        }
        const maxCount = Math.max(...Array.from(countrySongCounts.values()), 1);
        const safeMaxCount = Math.max(1, maxCount);
        const midPoint = Math.round(Math.sqrt(safeMaxCount));
        let domainPoints = [1, safeMaxCount];
        if (midPoint > 1 && midPoint < safeMaxCount) domainPoints = [1, midPoint, safeMaxCount];
        else if (safeMaxCount === 1) domainPoints = [1, 1.00001];
        domainPoints = [...new Set(domainPoints)].sort((a, b) => a - b);
        if (domainPoints.length === 1 && domainPoints[0] === 1) domainPoints.push(1.00001);

        const legendColorScale = d3.scaleLog<string, string>().domain(domainPoints).range(["#C7F9CC", "#1ED760", "#00441B"].slice(0, domainPoints.length)).interpolate(d3.interpolateRgb).clamp(true);
        let steps = [1];
        if (midPoint > 1 && midPoint < maxCount) steps.push(midPoint);
        if (maxCount > 1) steps.push(maxCount);
        steps = [...new Set(steps.filter(s => s > 0))].sort((a, b) => a - b);
        if (steps.length === 0 && maxCount === 1) steps = [1];
        const newLegendItems: LegendItem[] = [];
        if (steps.length > 0) {
            steps.forEach((step, index) => {
                const color = legendColorScale(step);
                let labelText = `${step}`;
                if (index === steps.length - 1 && steps.length > 1 && step > (steps[index - 1] || 0)) {
                    labelText = `${steps[index - 1] === 1 ? steps[index - 1] : (steps[index - 1] || step)}+`;
                    if (steps.length === 1 && step === 1) labelText = "1";
                    else if (steps.length === 1 && step > 1) labelText = "1+";
                }
                if (steps.length === 1 || (index < steps.length - 1 && steps[index + 1] === step + 1)) {
                    labelText = `${step}`;
                }
                newLegendItems.push({ color, label: `${labelText} song${(step === 1 && !labelText.endsWith('+')) ? '' : 's'}` });
            });
        }
        const zeroColor = getCountryColor(0, maxCount);
        newLegendItems.unshift({ color: zeroColor, label: "0 songs" });
        const distinctLegendItems = newLegendItems.reduce((acc, current) => {
            if (!acc.find(item => item.label.toLowerCase() === current.label.toLowerCase())) acc.push(current);
            return acc;
        }, [] as LegendItem[]);
        setLegendItems(distinctLegendItems);
    }, [countrySongCounts, currentTracks.length, isLoadingArtistCountries, isAggregating]);

    // Loader Message Logic
    const loaderMessage = useMemo(() => {
        if (authStatus === "loading" && !session) return "Authenticating...";
        else if (isLoadingPlaylists && playlists.length === 0) return "Fetching your playlists from Spotify...";
        else if (isLoadingLikedSongs) return "Fetching your liked songs from Spotify...";
        else if (isLoadingPlaylistTracks) {
            const pName = playlists.find(p => p.id === selectedPlaylistId)?.name || "selected playlist";
            const pTotal = playlists.find(p => p.id === selectedPlaylistId)?.tracks.total || 0;
            return `Fetching ${pTotal > 0 ? pTotal : ''} tracks for "${pName}"...`;
        } else if (currentTracks.length > 0 && isLoadingArtistCountries) {
            return `Processing ${currentTracks.length} songs: Retrieving artist origins (${processedArtistCountForLoader}/${totalUniqueArtistsInCurrentSet} artists)...`;
        } else if (currentTracks.length > 0 && !isLoadingArtistCountries && isAggregating) {
            return `Processing ${currentTracks.length} songs: Aggregating map data...`;
        }
        return null;
    }, [authStatus, session, isLoadingPlaylists, playlists, isLoadingLikedSongs, isLoadingPlaylistTracks, selectedPlaylistId, currentTracks, isLoadingArtistCountries, processedArtistCountForLoader, totalUniqueArtistsInCurrentSet, isAggregating]);

    const value = {
        artistCountries,
        isLoadingArtistCountries,
        unknownsCount,
        unknownsList,
        totalUniqueArtistsInCurrentSet,
        processedArtistCountForLoader,
        countrySongCounts,
        isAggregating,
        legendItems,
        singleCountryDetails,
        setSingleCountryDetails,
        isSingleCountryPanelOpen,
        setIsSingleCountryPanelOpen,
        multiSelectedCountries,
        setMultiSelectedCountries,
        multiCountryDisplayData,
        setMultiCountryDisplayData,
        isMultiCountryPanelOpen,
        setIsMultiCountryPanelOpen,
        isMultiSelectModeActive,
        setIsMultiSelectModeActive,
        isUnknownsWindowOpen,
        setIsUnknownsWindowOpen,
        handleMapClick,
        handleShowMultiCountryDetails,
        closeAnyPanelAndResets,
        loaderMessage
    };

    return (
        <MapContext.Provider value={value}>
            {children}
        </MapContext.Provider>
    );
}

export function useMapContext() {
    const context = useContext(MapContext);
    if (context === undefined) {
        throw new Error('useMapContext must be used within a MapProvider');
    }
    return context;
}
