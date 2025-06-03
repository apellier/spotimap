// src/app/page.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import React, { useState, useEffect, ChangeEvent, useCallback } from "react";
import * as d3 from 'd3'; // Import D3

// Import Hooks
//import { useTheme } from '@/contexts/ThemeContext'; // Already handled in TopMenu
import { useSpotifyData } from '@/hooks/useSpotifyData'; //
import { useArtistOrigins } from '@/hooks/useArtistOrigins'; //
import { useMapData } from '@/hooks/useMapData'; //

// Import Components
import TopMenu from '@/components/TopMenu'; //
import MapComponent from '@/components/MapComponent'; //
import MapLegend from '@/components/MapLegend'; //
import LoginScreen from '@/components/LoginScreen'; //
import CountryDetailsPanel from '@/components/CountryDetailsPanel'; //
import UnknownsPanel from '@/components/UnknownsPanel'; //
import StatusLoader from '@/components/StatusLoader'; // Assuming StatusLoader is in this path

// Import Types
import { SelectedCountryInfo, Track, LegendItem, ArtistDetail } from '@/types'; //

// Import Utilities
import { callSpotifyApi } from '@/lib/spotifyApi'; //
import { getCountryColor } from '@/utils/mapUtils'; //

// Import Vercel analytics
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

// Helper function to get unique artists (can be moved to a utils file if preferred)
const getUniqueFirstArtistsFromTracks = (tracks: Array<{ track: Track }>): string[] => {
    const firstArtists = new Set<string>();
    tracks.forEach(item => {
        if (item.track?.artists && item.track.artists.length > 0) { //
            const firstArtist = item.track.artists[0]; //
            if (firstArtist?.name) firstArtists.add(firstArtist.name.toLowerCase()); // Store lowercase for consistency
        }
    });
    return Array.from(firstArtists);
};


export default function HomePage() {
    const { data: session, status: authStatus } = useSession();
    //const { theme: currentTheme, toggleTheme } = useTheme(); // TopMenu handles its own theme via useTheme

    const {
        likedSongs, isLoadingLikedSongs, fetchLikedSongs, //
        playlists, isLoadingPlaylists, //
        playlistTracks, isLoadingPlaylistTracks, fetchTracksForPlaylist //
    } = useSpotifyData(); //

    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
    const [currentSourceLabel, setCurrentSourceLabel] = useState<string>("Select Source");

    const currentTracks: Array<{ track: Track }> = selectedPlaylistId ? playlistTracks : likedSongs; //

    const {
        artistCountries, isLoadingArtistCountries, unknownsCount, unknownsList, totalUniqueArtistsInCurrentSet, processedArtistCountForLoader //
    } = useArtistOrigins(currentTracks); //

    const { countrySongCounts, isAggregating } = useMapData(currentTracks, artistCountries, isLoadingArtistCountries); //
    const [legendItems, setLegendItems] = useState<LegendItem[]>([]); //


    // UI Panel/Modal States
    const [isCountryPanelOpen, setIsCountryPanelOpen] = useState(false);
    const [selectedCountryDetails, setSelectedCountryDetails] = useState<SelectedCountryInfo | null>(null);
    const [isUnknownsWindowOpen, setIsUnknownsWindowOpen] = useState(false);

    // Playback & Playlist Creation States
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [playbackLoading, setPlaybackLoading] = useState<string | null>(null); //
    const [playlistCreationStatus, setPlaylistCreationStatus] = useState<string | null>(null); //
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false); //

    // --- Loader State ---
    const [loaderMessage, setLoaderMessage] = useState<string | null>(null);
    const [totalUniqueArtistsToProcess, setTotalUniqueArtistsToProcess] = useState(0);

    const isLoadingAnythingNonAuth = isLoadingLikedSongs || isLoadingPlaylists || isLoadingPlaylistTracks || isLoadingArtistCountries || isAggregating; //


    // Update total unique artists when currentTracks change and are about to be processed for origins
    useEffect(() => {
        if (currentTracks.length > 0 && !isLoadingLikedSongs && !isLoadingPlaylistTracks) {
            const uniqueArtists = getUniqueFirstArtistsFromTracks(currentTracks);
            setTotalUniqueArtistsToProcess(uniqueArtists.length);
        } else {
            setTotalUniqueArtistsToProcess(0);
        }
    }, [currentTracks, isLoadingLikedSongs, isLoadingPlaylistTracks]);


    // --- Effect to manage loader messages ---
    useEffect(() => {
        if (authStatus === "loading" && !session) {
            setLoaderMessage("Authenticating...");
        } else if (isLoadingPlaylists && playlists.length === 0) {
            setLoaderMessage("Fetching your playlists from Spotify...");
        } else if (isLoadingLikedSongs) {
            setLoaderMessage("Fetching your liked songs from Spotify...");
        } else if (isLoadingPlaylistTracks) {
            const playlistName = playlists.find(p => p.id === selectedPlaylistId)?.name || "selected playlist";
            const totalTracksInPlaylist = playlists.find(p => p.id === selectedPlaylistId)?.tracks.total || 0;
            setLoaderMessage(`Fetching ${totalTracksInPlaylist > 0 ? totalTracksInPlaylist : ''} tracks for "${playlistName}"...`);
        } else if (currentTracks.length > 0 && isLoadingArtistCountries) {
            // Use processedArtistCountForLoader for incremental progress in message
            setLoaderMessage(
                `Processing ${currentTracks.length} songs: Retrieving artist origins (${processedArtistCountForLoader}/${totalUniqueArtistsInCurrentSet} artists)...`
            );
        } else if (currentTracks.length > 0 && !isLoadingArtistCountries && isAggregating) {
            setLoaderMessage(`Processing ${currentTracks.length} songs: Aggregating map data...`);
        } else {
            setLoaderMessage(null); // No loading active
        }
    }, [
        authStatus, session,
        isLoadingPlaylists, playlists, selectedPlaylistId,
        isLoadingLikedSongs,
        isLoadingPlaylistTracks,
        currentTracks.length,
        isLoadingArtistCountries, processedArtistCountForLoader, totalUniqueArtistsInCurrentSet, // Use new progress count
        isAggregating
    ]);


    // --- Legend Item Generation (D3-inspired) ---
    useEffect(() => {
        if (countrySongCounts.size === 0 && Array.from(countrySongCounts.values()).every(c => c === 0) && currentTracks.length > 0 && !isLoadingArtistCountries && !isAggregating) { //
             // Only show "0 songs" if tracks are loaded but all counts are zero
            const maxCountForLegend = Math.max(...Array.from(countrySongCounts.values()), 0); //
            setLegendItems([{ color: getCountryColor(0, maxCountForLegend), label: "0 songs" }]); //
            return;
        }
        if (countrySongCounts.size === 0 && currentTracks.length === 0 && !isLoadingArtistCountries && !isAggregating ) { //
            setLegendItems([]); // Clear legend if no tracks and no counts
            return;
        }


        const maxCount = Math.max(...Array.from(countrySongCounts.values()), 1); //
        const safeMaxCount = Math.max(1, maxCount); //
        const midPoint = Math.round(Math.sqrt(safeMaxCount)); //

        let domainPoints = [1, safeMaxCount]; //
        if (midPoint > 1 && midPoint < safeMaxCount) { //
            domainPoints = [1, midPoint, safeMaxCount]; //
        } else if (safeMaxCount === 1) { // Only one song max //
            domainPoints = [1, 1.00001]; // d3 scale needs distinct domain points //
        }
        // Ensure domainPoints are sorted and unique if logic gets complex
        domainPoints = [...new Set(domainPoints)].sort((a, b) => a - b); //
        if (domainPoints.length === 1 && domainPoints[0] === 1) domainPoints.push(1.00001); // Handle single point domain for maxCount=1 //

        const legendColorScale = d3.scaleLog<string, string>() //
            .domain(domainPoints) //
            .range(["#C7F9CC", "#1ED760", "#00441B"].slice(0, domainPoints.length)) // Ensure range matches domain length //
            .interpolate(d3.interpolateRgb) //
            .clamp(true); //

        let steps = [1]; //
        if (midPoint > 1 && midPoint < maxCount) { //
            steps.push(midPoint); //
        }
        if (maxCount > 1) { //
            steps.push(maxCount); //
        }
        steps = [...new Set(steps.filter(s => s > 0))].sort((a, b) => a - b); //
        if (steps.length === 0 && maxCount === 1) steps = [1]; //


        const newLegendItems: LegendItem[] = []; //
        if (steps.length > 0) { //
            steps.forEach((step, index) => { //
                const color = legendColorScale(step); //
                let labelText = `${step}`; //
                if (index === steps.length - 1 && steps.length > 1 && step > (steps[index-1] || 0) ) { //
                    labelText = `${steps[index-1] === 1 ? steps[index-1] : (steps[index-1] || step)}+`; // Use previous step for X+ if not 1 //
                    if (steps.length === 1 && step === 1) labelText = "1"; // handle maxCount=1 correctly //
                    else if (steps.length ===1 && step > 1) labelText = "1+"; // If only one step and it's >1 //
                }
                 // Refine label for single value steps
                if (steps.length === 1 || (index < steps.length -1 && steps[index+1] === step +1 ) ){ //
                     labelText = `${step}`; //
                }


                newLegendItems.push({ color, label: `${labelText} song${(step === 1 && !labelText.endsWith('+')) ? '' : 's'}` }); //
            });
        }


        // Add the "0 songs" entry consistently
        const zeroColor = getCountryColor(0, maxCount); // Get the defined '0 songs' color //
        newLegendItems.unshift({ color: zeroColor, label: "0 songs" }); //

        // Filter out duplicate labels (e.g., if "1 songs" and "1+ songs" are for the same step value)
        const distinctLegendItems = newLegendItems.reduce((acc, current) => { //
            if (!acc.find(item => item.label.toLowerCase() === current.label.toLowerCase())) { //
                acc.push(current); //
            }
            return acc; //
        }, [] as LegendItem[]); //

        setLegendItems(distinctLegendItems); //

    }, [countrySongCounts, currentTracks.length, isLoadingArtistCountries, isAggregating]); // Added dependencies //

    // --- UI Handlers (fetchLikedSongs, handlePlaylistChange, etc. - Keep from your previous working version) ---
    const handleFetchLikedSongs = useCallback(() => { //
        setIsCountryPanelOpen(false); setIsUnknownsWindowOpen(false); setPlaybackError(null); setPlaylistCreationStatus(null); //
        fetchLikedSongs(); //
        setSelectedPlaylistId(""); setCurrentSourceLabel("Liked Songs"); //
    }, [fetchLikedSongs]); //

    const handlePlaylistChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => { //
        setIsCountryPanelOpen(false); setIsUnknownsWindowOpen(false); setPlaybackError(null); setPlaylistCreationStatus(null); //
        const newPlaylistId = event.target.value; //
        setSelectedPlaylistId(newPlaylistId); //
        if (newPlaylistId) { //
            fetchTracksForPlaylist(newPlaylistId); //
            const playlist = playlists.find(p => p.id === newPlaylistId); //
            setCurrentSourceLabel(playlist ? playlist.name : "Selected Playlist"); //
        } else { //
            setCurrentSourceLabel("Select Source"); //
        }
    }, [fetchTracksForPlaylist, playlists]); //

    const handleCountryClick = useCallback((isoCode: string, countryNameFromMap: string) => { //
        const songCount = countrySongCounts.get(isoCode.toUpperCase()) || 0; //
        const artistsFromCountry: ArtistDetail[] = []; //
        if (songCount > 0) { //
            currentTracks.forEach(item => { //
                if (item.track?.artists?.[0]?.name) { //
                    const firstArtist = item.track.artists[0]; //
                    const artistCountry = artistCountries.get(firstArtist.name.toLowerCase()); //
                    if (artistCountry?.toUpperCase() === isoCode.toUpperCase()) { //
                        let existingArtist = artistsFromCountry.find(a => a.name === firstArtist.name); //
                        if (!existingArtist) { existingArtist = { name: firstArtist.name, songs: [] }; artistsFromCountry.push(existingArtist); } //
                        if (item.track) existingArtist.songs.push({ id: item.track.id, name: item.track.name }); //
                    }
                }
            });
        }
        artistsFromCountry.sort((a,b) => a.name.localeCompare(b.name)).forEach(a => a.songs.sort((s1,s2)=>s1.name.localeCompare(s2.name))); //
        setSelectedCountryDetails({ isoCode, name: countryNameFromMap, songCount, artists: artistsFromCountry }); //
        setIsCountryPanelOpen(true); setPlaybackError(null); setPlaylistCreationStatus(null); //
    }, [countrySongCounts, currentTracks, artistCountries]); //

    const handleUnknownsClick = () => setIsUnknownsWindowOpen(prev => !prev); //
    const closeCountryPanel = () => { setIsCountryPanelOpen(false); setPlaybackError(null); setPlaylistCreationStatus(null); }; //

    const handlePlaySong = useCallback(async (trackId: string) => {  //
        if (!session?.accessToken || !trackId) { setPlaybackError("Authentication or Track ID missing."); return; } //
        setPlaybackLoading(trackId); setPlaybackError(null); //
        try { await callSpotifyApi('/me/player/play', 'PUT', session.accessToken, { uris: [`spotify:track:${trackId}`] }); } //
        catch (error: any) { setPlaybackError(error.message || "Failed to play song."); } //
        finally { setPlaybackLoading(null); } //
    }, [session]); //

    const handlePlayCountrySongsRandomly = useCallback(async () => {  //
        if (!session?.accessToken || !selectedCountryDetails) { setPlaybackError("Auth or country details missing."); setPlaybackLoading(null); return; } //
        setPlaybackLoading("country-random"); setPlaybackError(null); setPlaylistCreationStatus(null); //
        const trackUris: string[] = selectedCountryDetails.artists.flatMap(artist => artist.songs.map(song => `spotify:track:${song.id}`)); //
        if (trackUris.length === 0) { setPlaybackError("No songs to play."); setPlaybackLoading(null); return; } //
        for (let i = trackUris.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [trackUris[i], trackUris[j]] = [trackUris[j], trackUris[i]]; } //
        try { //
            let deviceId: string | undefined = undefined; //
            try { //
                const devicesData = await callSpotifyApi('/me/player/devices', 'GET', session.accessToken); //
                if (devicesData?.devices?.length > 0) { const activeDevice = devicesData.devices.find((d: any) => d.is_active === true); deviceId = activeDevice?.id || devicesData.devices[0]?.id; } //
            } catch (deviceError: any) { console.warn("Could not fetch Spotify devices:", deviceError.message); } //
            let shuffleUrl = `/me/player/shuffle?state=true`; if (deviceId) shuffleUrl += `&device_id=${deviceId}`; //
            await callSpotifyApi(shuffleUrl, 'PUT', session.accessToken); //
            const playBody: { uris: string[]; device_id?: string } = { uris: trackUris }; if (deviceId) playBody.device_id = deviceId; //
            await callSpotifyApi('/me/player/play', 'PUT', session.accessToken, playBody); //
        } catch (error: any) { console.error("Error playing country songs randomly:", error); setPlaybackError(error.message || "Failed to play. Ensure Spotify is open & Premium."); } //
        finally { setPlaybackLoading(null); } //
     }, [session, selectedCountryDetails]); //

    const handleSaveCountrySongsToPlaylist = useCallback(async () => {  //
        if (!session?.accessToken || !selectedCountryDetails || !session.user?.id) { setPlaylistCreationStatus("Auth, country details, or user ID missing."); return; } //
        setIsCreatingPlaylist(true); setPlaylistCreationStatus("Creating playlist..."); //
        const { name: countryName, artists: artistsDetails } = selectedCountryDetails; //
        const trackUris: string[] = artistsDetails.flatMap(artist => artist.songs.map(song => `spotify:track:${song.id}`)); //
        if (trackUris.length === 0) { setPlaylistCreationStatus("No songs to add."); setIsCreatingPlaylist(false); return; } //
        try { //
            const newPlaylist = await callSpotifyApi(`/users/${session.user.id}/playlists`, 'POST', session.accessToken, { name: `Songs from ${countryName} (MapApp)`, public: false, description: `Songs from ${countryName}. Contains ${trackUris.length} songs.` }); //
            if (!newPlaylist?.id) throw new Error("Failed to create playlist."); //
            setPlaylistCreationStatus(`Playlist "${newPlaylist.name}" created! Adding songs...`); //
            const CHUNK_SIZE = 100; //
            for (let i = 0; i < trackUris.length; i += CHUNK_SIZE) { await callSpotifyApi(`/playlists/${newPlaylist.id}/tracks`, 'POST', session.accessToken, { uris: trackUris.slice(i, i + CHUNK_SIZE) }); } //
            setPlaylistCreationStatus(`Added ${trackUris.length} songs to "${newPlaylist.name}"!`); //
        } catch (error: any) { setPlaylistCreationStatus(`Error: ${error.message || "Failed to save playlist."}`); } //
        finally { setIsCreatingPlaylist(false); } //
    }, [session, selectedCountryDetails]); //


    // --- RENDER LOGIC ---
    if (authStatus === "loading" && !session && !loaderMessage) { //
        return <div className="flex min-h-screen items-center justify-center text-lg text-nb-text/70">Authenticating...</div>; //
    }
    
    if (!session) { //
        return <LoginScreen onSignIn={() => signIn("spotify")} />; //
    }

    return (
        <div className="flex min-h-screen flex-col bg-nb-bg text-nb-text"> {/* */}
            {loaderMessage && <StatusLoader message={loaderMessage} />}
            
            <TopMenu
                isLoggedIn={!!session} //
                userName={session.user?.name} //
                onSignOut={() => signOut()} //
                onSignIn={() => signIn("spotify")} //
                currentSourceLabel={currentSourceLabel} //
                onFetchLikedSongs={handleFetchLikedSongs} //
                playlists={playlists} //
                selectedPlaylistId={selectedPlaylistId} //
                onPlaylistChange={handlePlaylistChange} //
                isLoadingData={isLoadingAnythingNonAuth} //
                isLoadingPlaylists={isLoadingPlaylists} //
                unknownsCount={unknownsCount} //
                onUnknownsClick={handleUnknownsClick} //
            />

            <main className="flex flex-grow pt-[55px]"> {/* */}
                <div className="relative flex-grow"> {/* */}
                     {(currentTracks.length > 0 || isLoadingLikedSongs || isLoadingPlaylistTracks || (isLoadingPlaylists && playlists.length ===0 && loaderMessage) ) ? ( //
                        <>
                            <MapComponent
                                countrySongCounts={countrySongCounts} //
                                onCountryClick={handleCountryClick} //
                            />
                            {legendItems.length > 0 && <MapLegend legendItems={legendItems} />} {/* */}
                        </>
                    ) : (
                         !loaderMessage && ( //
                            <div className="flex h-full w-full items-center justify-center border-nb-thick border-dashed border-nb-border/50 p-nb-lg text-center text-nb-text/70"> {/* */}
                                <p>Select &quot;Liked Songs&quot; or a playlist from the top menu to begin exploring your music map!</p> {/* */}
                            </div>
                         )
                    )}

                    <UnknownsPanel
                        isOpen={isUnknownsWindowOpen} //
                        onClose={() => setIsUnknownsWindowOpen(false)} //
                        unknownsList={unknownsList} //
                    />
                </div>
            </main>

            <CountryDetailsPanel
                isOpen={isCountryPanelOpen} //
                onClose={closeCountryPanel} //
                details={selectedCountryDetails} //
                onPlaySong={handlePlaySong} //
                onPlayCountryRandomly={handlePlayCountrySongsRandomly} //
                onSavePlaylist={handleSaveCountrySongsToPlaylist} //
                playbackLoading={playbackLoading} //
                playbackError={playbackError} //
                isCreatingPlaylist={isCreatingPlaylist} //
                playlistCreationStatus={playlistCreationStatus} //
            />
            <Analytics />
            <SpeedInsights />
        </div>
    );
}