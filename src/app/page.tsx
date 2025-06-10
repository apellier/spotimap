// src/app/page.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import React, { useState, useEffect, ChangeEvent, useCallback, useMemo } from "react";
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import * as d3 from 'd3';

// Import Hooks
import { useSpotifyData } from '@/hooks/useSpotifyData';

import { useArtistOrigins } from '@/hooks/useArtistOrigins';
import { useMapData } from '@/hooks/useMapData';

// Import Components
import TopMenu from '@/components/TopMenu';
import MapComponent from '@/components/MapComponent';
import MapLegend from '@/components/MapLegend';
import LoginScreen from '@/components/LoginScreen';
import CountryDetailsPanel from '@/components/CountryDetailsPanel';
import UnknownsPanel from '@/components/UnknownsPanel';
import StatusLoader from '@/components/StatusLoader';
import MapControlPanel from "@/components/MapControlPanel";

// Import Types
import { 
    SelectedCountryInfo,
    LikedSongItem,
    PlaylistTrackItem,
    SpotifyTrack, 
    LegendItem, 
    ArtistDetail, 
    SelectedCountryBasicInfo, // For multi-select state
    MultiCountryDisplayInfo   // For multi-select panel data
} from '@/types';

// Import Utilities
import { callSpotifyApi } from '@/lib/spotifyApi';
import { getCountryColor } from '@/utils/mapUtils';

// Import Vercel analytics (as in your provided code)
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Helper function to get unique artists
const getUniqueFirstArtistsFromTracks = (tracks: Array<{ track: SpotifyTrack }>): string[] => {
    const firstArtists = new Set<string>();
    tracks.forEach(item => {
        if (item.track?.artists && item.track.artists.length > 0) {
            const firstArtist = item.track.artists[0];
            if (firstArtist?.name) firstArtists.add(firstArtist.name.toLowerCase());
        }
    });
    return Array.from(firstArtists);
};

// Helper function to get Spotify Device ID (ensure this is defined or imported)
async function getSpotifyDeviceId(accessToken: string): Promise<string | null> {
    if (!accessToken) return null;
    try {
        const devicesData = await callSpotifyApi('/me/player/devices', 'GET', accessToken);
        if (devicesData?.devices?.length > 0) {
            const activeDevice = devicesData.devices.find((d: any) => d.is_active === true);
            if (activeDevice?.id) return activeDevice.id;
            if (devicesData.devices[0]?.id) return devicesData.devices[0].id;
        }
        return null;
    } catch (error) {
        console.warn("Could not fetch Spotify devices:", error instanceof Error ? error.message : String(error));
        return null;
    }
}


export default function HomePage() {
    const { data: session, status: authStatus } = useSession();

    const {
        likedSongs, isLoadingLikedSongs, fetchLikedSongs,
        playlists, isLoadingPlaylists,
        playlistTracks, isLoadingPlaylistTracks, fetchTracksForPlaylist
    } = useSpotifyData();

    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
    const [currentSourceLabel, setCurrentSourceLabel] = useState<string>("Select Source");

    const rawTracks: Array<LikedSongItem | PlaylistTrackItem> = selectedPlaylistId ? playlistTracks : likedSongs;

    const currentTracks = useMemo(() => {
        type ValidTrackItem = (LikedSongItem | PlaylistTrackItem) & { track: SpotifyTrack };
        return rawTracks.filter((item): item is ValidTrackItem => item.track !== null);
    }, [rawTracks]);

    const {
        artistCountries, isLoadingArtistCountries, unknownsCount, unknownsList, 
        totalUniqueArtistsInCurrentSet, processedArtistCountForLoader
    } = useArtistOrigins(currentTracks);

    const { countrySongCounts, isAggregating } = useMapData(currentTracks, artistCountries, isLoadingArtistCountries);
    const [legendItems, setLegendItems] = useState<LegendItem[]>([]);

    // State for single country selection & panel
    const [singleCountryDetails, setSingleCountryDetails] = useState<SelectedCountryInfo | null>(null);
    const [isSingleCountryPanelOpen, setIsSingleCountryPanelOpen] = useState(false);

    // State for multi-country selection
    const [multiSelectedCountries, setMultiSelectedCountries] = useState<SelectedCountryBasicInfo[]>([]);
    
    // State for multi-country panel data & visibility
    const [multiCountryDisplayData, setMultiCountryDisplayData] = useState<MultiCountryDisplayInfo | null>(null);
    const [isMultiCountryPanelOpen, setIsMultiCountryPanelOpen] = useState(false);
    
    // State for unknowns panel
    const [isUnknownsWindowOpen, setIsUnknownsWindowOpen] = useState(false);

    // Playback & Playlist Creation States
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [playbackLoading, setPlaybackLoading] = useState<string | null>(null);
    const [playlistCreationStatus, setPlaylistCreationStatus] = useState<string | null>(null);
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

    // Loader State
    const [loaderMessage, setLoaderMessage] = useState<string | null>(null);
    // const [totalUniqueArtistsToProcess, setTotalUniqueArtistsToProcess] = useState(0); // This seemed unused, ensure if needed

    const isLoadingAnythingNonAuth = isLoadingLikedSongs || isLoadingPlaylists || isLoadingPlaylistTracks || isLoadingArtistCountries || isAggregating;

    const closeAnyPanelAndResets = useCallback(() => {
        setIsSingleCountryPanelOpen(false);
        setSingleCountryDetails(null);
        setIsMultiCountryPanelOpen(false);
        setMultiCountryDisplayData(null);
        setMultiSelectedCountries([]);
        setPlaybackError(null);
        setPlaylistCreationStatus(null);
    }, []); // State setters are stable, empty array is fine.

    const [isMultiSelectModeActive, setIsMultiSelectModeActive] = useState(false);

    const MIN_TIMELINE_SPEED_MS = 10;
    const MAX_TIMELINE_SPEED_MS = 200;
    const TIMELINE_SPEED_STEP = 10;
    const BASE_SPEED_MS = 50;

    const [isRescanning, setIsRescanning] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const handleChangeSpeed = (direction: 'increase' | 'decrease') => {
        setTimelineSpeed(currentSpeed => {
            if (direction === 'increase') {
                // Increasing speed means decreasing the interval time
                return Math.max(MIN_TIMELINE_SPEED_MS, currentSpeed - TIMELINE_SPEED_STEP);
            } else {
                // Decreasing speed means increasing the interval time
                return Math.min(MAX_TIMELINE_SPEED_MS, currentSpeed + TIMELINE_SPEED_STEP);
            }
        });
    };

    const [isExportingMap, setIsExportingMap] = useState(false);
    const handleExportMap = () => {
        if (isExportingMap) return;
        setIsExportingMap(true);
    };


    const handleRescanUnknowns = useCallback(async () => {
        setIsRescanning(true);
        setLoaderMessage("Clearing cache for unknown artists..."); // Use main loader for feedback

        try {
            const response = await fetch('/api/admin/clear-unknowns', {
                method: 'POST',
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to clear the cache.");
            }

            // Set a success message that will be displayed temporarily
            setStatusMessage({ text: data.message, type: 'success' });

        } catch (error: any) {
            // Set an error message
            setStatusMessage({ text: `Error: ${error.message}`, type: 'error' });
        } finally {
            setIsRescanning(false);
            setLoaderMessage(null); // Hide the main loader
            // Set a timeout to clear the status message after 5 seconds
            setTimeout(() => setStatusMessage(null), 5000);
        }
    }, []);

    
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
            if (isSingleCountryPanelOpen) {
                setIsSingleCountryPanelOpen(false);
                setSingleCountryDetails(null);
            }
            setIsMultiCountryPanelOpen(false); 
        } else {
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
            M_artistsFromCountry.sort((a,b) => a.name.localeCompare(b.name)).forEach(a => a.songs.sort((s1,s2)=>s1.name.localeCompare(s2.name)));
            
            setSingleCountryDetails({ isoCode, name: countryName, songCount: M_songCount, artists: M_artistsFromCountry });
            setIsSingleCountryPanelOpen(true);
            setPlaybackError(null);
            setPlaylistCreationStatus(null);
        }
    }, [isMultiSelectModeActive, isSingleCountryPanelOpen, countrySongCounts, currentTracks, artistCountries]);
    
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
            const M_finalArtists = Array.from(MartistsMap.values()).sort((a,b) => a.name.localeCompare(b.name));
            M_finalArtists.forEach(a => a.songs.sort((s1,s2)=>s1.name.localeCompare(s2.name)));
            
            setMultiCountryDisplayData({
                countries: countryInfoForPanel.sort((a,b) => a.name.localeCompare(b.name)),
                totalSongCount: MtotalSongCount,
                artists: M_finalArtists,
                allTrackUris: Array.from(MallTrackUris)
            });
            setIsMultiCountryPanelOpen(true);
            setIsSingleCountryPanelOpen(false); 
            setSingleCountryDetails(null);
            setPlaybackError(null);
            setPlaylistCreationStatus(null);
        }
    }, [multiSelectedCountries, countrySongCounts, currentTracks, artistCountries]);

    useEffect(() => { // Loader messages
        if (authStatus === "loading" && !session) setLoaderMessage("Authenticating...");
        else if (isLoadingPlaylists && playlists.length === 0) setLoaderMessage("Fetching your playlists from Spotify...");
        else if (isLoadingLikedSongs) setLoaderMessage("Fetching your liked songs from Spotify...");
        else if (isLoadingPlaylistTracks) {
            const pName = playlists.find(p => p.id === selectedPlaylistId)?.name || "selected playlist";
            const pTotal = playlists.find(p => p.id === selectedPlaylistId)?.tracks.total || 0;
            setLoaderMessage(`Fetching ${pTotal > 0 ? pTotal : ''} tracks for "${pName}"...`);
        } else if (currentTracks.length > 0 && isLoadingArtistCountries) {
            setLoaderMessage(`Processing ${currentTracks.length} songs: Retrieving artist origins (${processedArtistCountForLoader}/${totalUniqueArtistsInCurrentSet} artists)...`);
        } else if (currentTracks.length > 0 && !isLoadingArtistCountries && isAggregating) {
            setLoaderMessage(`Processing ${currentTracks.length} songs: Aggregating map data...`);
        } else setLoaderMessage(null);
    }, [authStatus, session, isLoadingPlaylists, playlists, selectedPlaylistId, isLoadingLikedSongs, isLoadingPlaylistTracks, currentTracks.length, isLoadingArtistCountries, processedArtistCountForLoader, totalUniqueArtistsInCurrentSet, isAggregating]);

    useEffect(() => { // Legend items
        // ... (Legend logic from your provided code - assumed correct and complete)
        if (countrySongCounts.size === 0 && Array.from(countrySongCounts.values()).every(c => c === 0) && currentTracks.length > 0 && !isLoadingArtistCountries && !isAggregating) {
            const maxCountForLegend = Math.max(...Array.from(countrySongCounts.values()), 0);
            setLegendItems([{ color: getCountryColor(0, maxCountForLegend), label: "0 songs" }]);
            return;
        }
        if (countrySongCounts.size === 0 && currentTracks.length === 0 && !isLoadingArtistCountries && !isAggregating ) {
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
                if (index === steps.length - 1 && steps.length > 1 && step > (steps[index-1] || 0) ) {
                    labelText = `${steps[index-1] === 1 ? steps[index-1] : (steps[index-1] || step)}+`;
                    if (steps.length === 1 && step === 1) labelText = "1";
                    else if (steps.length ===1 && step > 1) labelText = "1+";
                }
                if (steps.length === 1 || (index < steps.length -1 && steps[index+1] === step +1 ) ){
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

    const handleFetchLikedSongs = useCallback(() => {
        closeAnyPanelAndResets(); // Close panels when changing source
        fetchLikedSongs();
        setSelectedPlaylistId(""); setCurrentSourceLabel("Liked Songs");
    }, [fetchLikedSongs, closeAnyPanelAndResets]);

    const handlePlaylistChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        closeAnyPanelAndResets(); // Close panels when changing source
        const newPlaylistId = event.target.value;
        setSelectedPlaylistId(newPlaylistId);
        if (newPlaylistId) {
            fetchTracksForPlaylist(newPlaylistId);
            const playlist = playlists.find(p => p.id === newPlaylistId);
            setCurrentSourceLabel(playlist ? playlist.name : "Selected Playlist");
        } else {
            setCurrentSourceLabel("Select Source");
        }
    }, [fetchTracksForPlaylist, playlists, closeAnyPanelAndResets]);
    
    useEffect(() => { // "Esc" key handler
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (isMultiCountryPanelOpen || isSingleCountryPanelOpen) {
                    closeAnyPanelAndResets();
                } else if (isUnknownsWindowOpen) {
                    setIsUnknownsWindowOpen(false);
                } else if (multiSelectedCountries.length > 0) {
                    setMultiSelectedCountries([]);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isSingleCountryPanelOpen, isMultiCountryPanelOpen, isUnknownsWindowOpen, multiSelectedCountries.length, closeAnyPanelAndResets]);

    // Highlight logic: only for multi-selection
    const codesToHighlightOnMap = useMemo(() => {
        return multiSelectedCountries.length > 0
            ? multiSelectedCountries.map(c => c.isoCode)
            : []; // This empty array reference will now be stable if multiSelectedCountries remains empty
    }, [multiSelectedCountries]);
    
    const handlePlaySong = useCallback(async (trackId: string) => { /* ... (from previous response, uses getSpotifyDeviceId) ... */ 
        if (!session?.accessToken || !trackId) {
            setPlaybackError("Authentication or Track ID missing."); return;
        }
        setPlaybackLoading(trackId); setPlaybackError(null);
        try {
            const deviceId = await getSpotifyDeviceId(session.accessToken);
            if (!deviceId) {
                setPlaybackError("No active Spotify player found. Please open Spotify and play something, or ensure a device is available.");
                setPlaybackLoading(null); return;
            }
            await callSpotifyApi('/me/player/play', 'PUT', session.accessToken, { uris: [`spotify:track:${trackId}`], device_id: deviceId });
        } catch (error: any) {
            console.error("Error playing song:", error);
            let userMessage = "Failed to play song. Please ensure Spotify is open and responsive.";
            if (error.message) {
                if (error.message.includes("NO_ACTIVE_DEVICE")) userMessage = "No active Spotify device. Please start playback in your Spotify app and try again.";
                else if (error.message.includes("PREMIUM_REQUIRED")) userMessage = "Spotify Premium is required for this action.";
                else if (error.message.includes("Device not found")) userMessage = "Could not connect to the Spotify player. Please ensure it's active.";
                else if (error.message.length < 150) userMessage = error.message;
            }
            setPlaybackError(userMessage);
        } finally { setPlaybackLoading(null); }
    }, [session]);

    // For SINGLE country panel (uses singleCountryDetails)
    const handlePlaySingleCountryRandomly = useCallback(async () => {
        if (!session?.accessToken || !singleCountryDetails) {
            setPlaybackError("Authentication or country details missing."); setPlaybackLoading(null); return;
        }
        setPlaybackLoading("country-random"); setPlaybackError(null); setPlaylistCreationStatus(null);
        const trackUris: string[] = singleCountryDetails.artists.flatMap(artist => artist.songs.map(song => `spotify:track:${song.id}`));
        if (trackUris.length === 0) {
            setPlaybackError("No songs to play for this country selection."); setPlaybackLoading(null); return;
        }
        for (let i = trackUris.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [trackUris[i], trackUris[j]] = [trackUris[j], trackUris[i]]; }
        try {
            const deviceId = await getSpotifyDeviceId(session.accessToken);
            if (!deviceId) {
                setPlaybackError("No active Spotify player found."); setPlaybackLoading(null); return;
            }
            await callSpotifyApi(`/me/player/shuffle?state=true&device_id=${deviceId}`, 'PUT', session.accessToken);
            await callSpotifyApi('/me/player/play', 'PUT', session.accessToken, { uris: trackUris, device_id: deviceId });
        } catch (error: any) { /* ... error handling (as provided before, checking error.message) ... */ 
            let userMessage = "Failed to play. Ensure Spotify is open, responsive, and Premium if required.";
             if (error.message) {
                if (error.message.includes("NO_ACTIVE_DEVICE")) userMessage = "No active Spotify device.";
                else if (error.message.includes("PREMIUM_REQUIRED")) userMessage = "Spotify Premium may be required.";
                else if (error.message.length < 150) userMessage = error.message;
            }
            setPlaybackError(userMessage);
        } finally { setPlaybackLoading(null); }
     }, [session, singleCountryDetails, setPlaybackError, setPlaylistCreationStatus, setPlaybackLoading ]);

    const handleSaveSingleCountryPlaylist = useCallback(async () => {
        if (!session?.accessToken || !singleCountryDetails || !session.user?.id) {
            setPlaylistCreationStatus("Auth, country details, or user ID missing."); setIsCreatingPlaylist(false); return;
        }
        setIsCreatingPlaylist(true); setPlaylistCreationStatus("Creating playlist..."); setPlaybackError(null);
        const { name: countryName, artists: artistsDetails } = singleCountryDetails;
        const trackUris: string[] = artistsDetails.flatMap(artist => artist.songs.map(song => `spotify:track:${song.id}`));
        if (trackUris.length === 0) {
            setPlaylistCreationStatus("No songs to add."); setIsCreatingPlaylist(false); return;
        }
        try {
            const newPlaylist = await callSpotifyApi(`/users/${session.user.id}/playlists`, 'POST', session.accessToken, { name: `Songs from ${countryName} (SpotiMap)`, public: false, description: `Songs from ${countryName}. Contains ${trackUris.length} songs.` });
            if (!newPlaylist?.id) throw new Error("Failed to create playlist.");
            setPlaylistCreationStatus(`Playlist "${newPlaylist.name}" created! Adding songs...`);
            const CHUNK_SIZE = 100;
            for (let i = 0; i < trackUris.length; i += CHUNK_SIZE) { await callSpotifyApi(`/playlists/${newPlaylist.id}/tracks`, 'POST', session.accessToken, { uris: trackUris.slice(i, i + CHUNK_SIZE) }); }
            setPlaylistCreationStatus(`Added ${trackUris.length} songs to "${newPlaylist.name}"!`);
        } catch (error: any) { 
            let userMessage = "Failed to save playlist.";
            if (error.message && error.message.length < 150) userMessage = `Error: ${error.message}`;
            setPlaylistCreationStatus(userMessage);
        } finally { setIsCreatingPlaylist(false); }
    }, [session, singleCountryDetails, setIsCreatingPlaylist, setPlaylistCreationStatus, setPlaybackError]);

    // For MULTI country panel (uses multiCountryDisplayData)
    const handlePlayMultiCountryRandomly = useCallback(async () => { /* ... (implementation from previous response, uses multiCountryDisplayData) ... */ 
        if (!session?.accessToken || !multiCountryDisplayData || multiCountryDisplayData.allTrackUris.length === 0) {
            setPlaybackError(!session?.accessToken ? "Auth missing." : "No songs selected."); setPlaybackLoading(null); return;
        }
        setPlaybackLoading("multi-country-random"); setPlaybackError(null); setPlaylistCreationStatus(null);
        const trackUris = [...multiCountryDisplayData.allTrackUris];
        for (let i = trackUris.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [trackUris[i], trackUris[j]] = [trackUris[j], trackUris[i]];}
        try {
            const deviceId = await getSpotifyDeviceId(session.accessToken);
            if (!deviceId) { setPlaybackError("No active Spotify player."); setPlaybackLoading(null); return; }
            await callSpotifyApi(`/me/player/shuffle?state=true&device_id=${deviceId}`, 'PUT', session.accessToken);
            await callSpotifyApi('/me/player/play', 'PUT', session.accessToken, { uris: trackUris, device_id: deviceId });
        } catch (error: any) { /* ... error handling ... */ 
            let userMessage = "Failed to play. Ensure Spotify is open, responsive, and Premium if required.";
            if (error.message) {
               if (error.message.includes("NO_ACTIVE_DEVICE")) userMessage = "No active Spotify device.";
               else if (error.message.includes("PREMIUM_REQUIRED")) userMessage = "Spotify Premium may be required.";
               else if (error.message.length < 150) userMessage = error.message;
            }
            setPlaybackError(userMessage);
        } finally { setPlaybackLoading(null); }
    }, [session, multiCountryDisplayData, setPlaybackError, setPlaylistCreationStatus, setPlaybackLoading]);

    const handleSaveMultiCountryPlaylist = useCallback(async () => { /* ... (implementation from previous response, uses multiCountryDisplayData) ... */ 
        if (!session?.accessToken || !session.user?.id || !multiCountryDisplayData || multiCountryDisplayData.allTrackUris.length === 0) {
            setPlaylistCreationStatus("Auth, user ID, or song selection missing."); setIsCreatingPlaylist(false); return;
        }
        setIsCreatingPlaylist(true); setPlaylistCreationStatus("Creating playlist..."); setPlaybackError(null);
        let playlistName = "SpotiMap Multi-Country Mix"; /* ... (name generation logic from prev response) ... */
        if (multiCountryDisplayData.countries.length > 0) {
            if (multiCountryDisplayData.countries.length <= 3) playlistName = `Songs from ${multiCountryDisplayData.countries.map(c => c.name).join(', ')} (SpotiMap)`;
            else playlistName = `Songs from ${multiCountryDisplayData.countries.length} countries (SpotiMap)`;
        }
        if (playlistName.length > 100) playlistName = playlistName.substring(0, 97) + "...";
        const trackUrisToSave = multiCountryDisplayData.allTrackUris;
        try {
            const newPlaylist = await callSpotifyApi(`/users/${session.user.id}/playlists`, 'POST', session.accessToken, { name: playlistName, public: false, description: `Songs from SpotiMap selection. ${trackUrisToSave.length} songs.` });
            if (!newPlaylist?.id) throw new Error("Failed to create playlist ID.");
            setPlaylistCreationStatus(`Playlist "${newPlaylist.name}" created! Adding songs...`);
            const CHUNK_SIZE = 100;
            for (let i = 0; i < trackUrisToSave.length; i += CHUNK_SIZE) { await callSpotifyApi(`/playlists/${newPlaylist.id}/tracks`, 'POST', session.accessToken, { uris: trackUrisToSave.slice(i, i + CHUNK_SIZE) }); }
            setPlaylistCreationStatus(`Added ${trackUrisToSave.length} songs to "${newPlaylist.name}"!`);
        } catch (error: any) { /* ... error handling ... */ 
            let userMessage = "Failed to save playlist.";
            if (error.message && error.message.length < 150) userMessage = `Error: ${error.message}`;
            setPlaylistCreationStatus(userMessage);
        } finally { setIsCreatingPlaylist(false); }
    }, [session, multiCountryDisplayData, setIsCreatingPlaylist, setPlaylistCreationStatus, setPlaybackError]);

    const [isTimelineActive, setIsTimelineActive] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [timelineFrame, setTimelineFrame] = useState(0); // The current position (index) in the timeline
    const [timelineSpeed, setTimelineSpeed] = useState(50);

    const timelineData = useMemo(() => {
        // FIX: Add a check for `isLoadingArtistCountries`.
        // This ensures the expensive logic runs only ONCE after all data is ready.
        if (!isTimelineActive || isLoadingArtistCountries || currentTracks.length === 0 || artistCountries.size === 0) {
            return [];
        }
    
        console.log("Preparing timeline data (now that artist origins are loaded)...");
        
        type TimelineItem = { added_at: Date; country: string; trackName: string };
    
        const datedTracks = currentTracks
            .map(item => {
                const artistName = item.track?.artists?.[0]?.name.toLowerCase();
                const country = artistName ? artistCountries.get(artistName) : null;
                
                const addedDate = new Date(item.added_at);
                if (!country || isNaN(addedDate.getTime()) || !item.track.name) {
                    return null;
                }
    
                return {
                    added_at: addedDate,
                    country: country,
                    trackName: item.track.name,
                };
            })
            .filter((track): track is TimelineItem => track !== null);
    
        // This sort will now only run once per data set, after loading is complete.
        datedTracks.sort((a, b) => a.added_at.getTime() - b.added_at.getTime());
        
        return datedTracks;
    
    }, [isTimelineActive, currentTracks, artistCountries, isLoadingArtistCountries]);

    // --- NEW: Calculate map counts based on the current timeline frame ---
    const timelineMapCounts = useMemo(() => {
        const counts = new Map<string, number>();
        // If the timeline isn't active or data isn't ready, return empty counts
        if (!isTimelineActive || timelineData.length === 0) {
            return counts;
        }

        // Get the slice of tracks from the beginning up to the current frame
        const frameSlice = timelineData.slice(0, timelineFrame);

        // Calculate the song counts for this slice
        frameSlice.forEach(track => {
            counts.set(track.country, (counts.get(track.country) || 0) + 1);
        });

        return counts;
    }, [isTimelineActive, timelineFrame, timelineData]);

    useEffect(() => {
        // Only run the interval if timeline is active and isPlaying is true
        if (!isPlaying || !isTimelineActive) {
            return;
        }

        const timer = setInterval(() => {
            setTimelineFrame(prevFrame => {
                if (prevFrame >= timelineData.length) {
                    setIsPlaying(false); // Stop when the end is reached
                    return prevFrame;
                }
                // A 'step' could be one song or a group of songs for faster animation
                return prevFrame + 1; 
            });
        }, timelineSpeed);

        // Cleanup function to clear the interval
        return () => clearInterval(timer);
    }, [isPlaying, isTimelineActive, timelineData.length, timelineSpeed]);

    // RENDER LOGIC
    if (authStatus === "loading" && !session && !loaderMessage) {
        return <div className="flex min-h-screen items-center justify-center text-lg text-nb-text/70">Authenticating...</div>;
    }
    if (!session) {
        return <LoginScreen onSignIn={() => signIn("spotify")} />;
    }

    return (
        <div className="flex min-h-screen flex-col bg-nb-bg text-nb-text">
            {loaderMessage && <StatusLoader message={loaderMessage} />}
            
            <TopMenu
                isLoggedIn={!!session}
                userName={session.user?.name}
                onSignOut={() => signOut()}
                onSignIn={() => signIn("spotify")}
                currentSourceLabel={currentSourceLabel}
                onFetchLikedSongs={handleFetchLikedSongs}
                playlists={playlists}
                selectedPlaylistId={selectedPlaylistId}
                onPlaylistChange={handlePlaylistChange}
                isLoadingData={isLoadingAnythingNonAuth}
                isLoadingPlaylists={isLoadingPlaylists}
                unknownsCount={unknownsCount}
                onUnknownsClick={() => setIsUnknownsWindowOpen(prev => !prev)}
            />

            <main className="flex flex-grow pt-[55px]">
                <div className="relative flex-grow">

                    {statusMessage && (
                        <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-[1200] p-2 px-4 text-sm font-semibold rounded-nb border-2 shadow-nb transition-opacity duration-300 ${statusMessage.type === 'success' ? 'bg-nb-accent text-nb-text-on-accent border-nb-border' : 'bg-nb-accent-destructive text-nb-text-on-destructive border-nb-border'}`}>
                            {statusMessage.text}
                        </div>
                    )}
                    
                    {/* Render the new control panel only when data is loaded */}
                    {(currentTracks.length > 0 && !isLoadingAnythingNonAuth) && (
                        <MapControlPanel
                            isTimelineActive={isTimelineActive}
                            isMultiSelectModeActive={isMultiSelectModeActive}
                            multiSelectedCountriesCount={multiSelectedCountries.length}
                            isAnyPanelOpen={isSingleCountryPanelOpen || isMultiCountryPanelOpen}
                            onToggleTimeline={() => {
                                const isNowActivating = !isTimelineActive;
                                setIsTimelineActive(isNowActivating);
                                setIsPlaying(isNowActivating); // Auto-play when activating
                                setTimelineFrame(0);
                                if (isNowActivating) { // Clear other selections when starting timeline
                                    setMultiSelectedCountries([]);
                                    setIsMultiSelectModeActive(false);
                                }
                            }}
                            onToggleMultiSelect={() => setIsMultiSelectModeActive(prev => !prev)}
                            onShowMultiCountryDetails={handleShowMultiCountryDetails}
                            onRescanUnknowns={handleRescanUnknowns}
                            isRescanning={isRescanning}
                            onExportMap={handleExportMap}
                            isExporting={isExportingMap}
                        />
                    )}
                    
                    {/* Main Content: Map or Placeholder Text */}
                    {(currentTracks.length > 0 || isLoadingAnythingNonAuth ) ? (
                        <>
                            <MapComponent
                                countrySongCounts={isTimelineActive ? timelineMapCounts : countrySongCounts}
                                onCountryClick={handleMapClick}
                                selectedIsoCodes={codesToHighlightOnMap}
                                isExporting={isExportingMap}
                                onExportComplete={() => setIsExportingMap(false)}
                            />
                            {!isTimelineActive && legendItems.length > 0 && <MapLegend legendItems={legendItems} />}
                        </>
                    ) : (
                         !loaderMessage && (
                            <div className="flex h-full w-full items-center justify-center border-nb-thick border-dashed border-nb-border/50 p-nb-lg text-center text-nb-text/70">
                                <p>Select &quot;Liked Songs&quot; or a playlist from the top menu to begin exploring your music map!</p>
                            </div>
                         )
                    )}

                    <UnknownsPanel
                        isOpen={isUnknownsWindowOpen}
                        onClose={() => setIsUnknownsWindowOpen(false)}
                        unknownsList={unknownsList}
                    />

                    {/* Timeline Controls Panel (Bottom) */}
                    {isTimelineActive && timelineData.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 z-[1100] bg-nb-bg/80 p-4 shadow-lg backdrop-blur-sm">
                            <div className="relative flex items-center gap-4 max-w-screen-md mx-auto">
                                <button onClick={() => setIsPlaying(prev => !prev)} className="btn btn-icon w-12 h-12 text-xl">
                                    {isPlaying ? '❚❚' : '▶'}
                                </button>
                                <button onClick={() => { setTimelineFrame(0); setIsPlaying(false); }} className="btn btn-icon text-xl">
                                    ↺
                                </button>
                                <div className="flex-grow text-center">
                                    <input
                                        type="range"
                                        min="0"
                                        max={timelineData.length}
                                        value={timelineFrame}
                                        onChange={(e) => {
                                            setIsPlaying(false);
                                            setTimelineFrame(Number(e.target.value));
                                        }}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                    />
                                    <div className="text-xs mt-1 text-nb-text/80">
                                        {timelineData[timelineFrame - 1]?.added_at.toLocaleDateString() || "Start"}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleChangeSpeed('decrease')} className="btn btn-icon w-8 h-8 flex items-center justify-center p-0" title="Slow down" disabled={timelineSpeed >= MAX_TIMELINE_SPEED_MS}>
                                        <MinusIcon className="w-4 h-4 stroke-2" />
                                    </button>
                                    <div className="text-xs font-mono w-12 text-center" title="Animation speed">
                                        {(BASE_SPEED_MS / timelineSpeed).toFixed(1)}x
                                    </div>
                                    <button onClick={() => handleChangeSpeed('increase')} className="btn btn-icon w-8 h-8 flex items-center justify-center p-0" title="Speed up" disabled={timelineSpeed <= MIN_TIMELINE_SPEED_MS}>
                                        <PlusIcon className="w-4 h-4 stroke-2" />
                                    </button>
                                </div>

                                <div className="w-40 text-left text-xs hidden sm:block">
                                    <p className="font-bold truncate mb-0">Now Adding:</p>
                                    <div className="leading-tight text-nb-text/80">
                                        <p className="truncate m-0">{timelineData[timelineFrame - 1]?.trackName || "..."}</p>
                                        <p className="truncate m-0 font-semibold">{timelineData[timelineFrame - 1]?.country || "..."}</p>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => { setIsTimelineActive(false); setIsPlaying(false); }}
                                    className="btn btn-icon absolute -top-2 -right-2 w-8 h-8 text-2xl flex items-center justify-center"
                                    title="Hide Timeline"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <CountryDetailsPanel
                isOpen={isSingleCountryPanelOpen || isMultiCountryPanelOpen}
                onClose={closeAnyPanelAndResets}
                details={isMultiCountryPanelOpen ? multiCountryDisplayData : singleCountryDetails}
                onPlaySong={handlePlaySong}
                onPlayCountryRandomly={isMultiCountryPanelOpen ? handlePlayMultiCountryRandomly : handlePlaySingleCountryRandomly}
                onSavePlaylist={isMultiCountryPanelOpen ? handleSaveMultiCountryPlaylist : handleSaveSingleCountryPlaylist}
                playbackLoading={playbackLoading}
                playbackError={playbackError}
                isCreatingPlaylist={isCreatingPlaylist}
                playlistCreationStatus={playlistCreationStatus}
            />
            
            <Analytics />
            <SpeedInsights />
        </div>
    );
}