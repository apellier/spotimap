// src/components/CountryDetailsPanel.tsx
"use client";

import React from 'react';
import styles from '../app/page.module.css'; //
import { SelectedCountryInfo, MultiCountryDisplayInfo, ArtistDetail } from '@/types'; //

interface CountryDetailsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    details: SelectedCountryInfo | MultiCountryDisplayInfo | null; // Can receive either type
    
    // Playback & Playlist Action Handlers & State
    onPlaySong: (trackId: string) => void;
    onPlayCountryRandomly: () => void; // Generic handler, page.tsx determines if it's single/multi
    onSavePlaylist: () => void;      // Generic handler, page.tsx determines if it's single/multi
    playbackLoading: string | null; 
    playbackError: string | null;
    isCreatingPlaylist: boolean;
    playlistCreationStatus: string | null;
}

const CountryDetailsPanel: React.FC<CountryDetailsPanelProps> = ({
    isOpen,
    onClose,
    details,
    onPlaySong,
    onPlayCountryRandomly,
    onSavePlaylist,
    playbackLoading,
    playbackError,
    isCreatingPlaylist,
    playlistCreationStatus,
}) => {
    if (!isOpen || !details) {
        return null;
    }

    // Type guard to determine if details are for multiple countries or a single one
    const isMultiView = 'countries' in details && Array.isArray(details.countries);
    
    let panelTitle: string;
    let displaySongCount: number;
    let displayArtists: ArtistDetail[];
    let countriesList: Array<{ isoCode: string; name: string; songCount: number }> | null = null;

    if (isMultiView) {
        const multiDetails = details as MultiCountryDisplayInfo;
        const countryNames = multiDetails.countries.map(c => c.name).join(', ');
        panelTitle = multiDetails.countries.length === 1 
            // This case should ideally be handled by page.tsx sending SelectedCountryInfo
            // but as a fallback if multiCountryDisplayData has only one entry:
            ? `${multiDetails.countries[0].name} (${multiDetails.countries[0].isoCode})` 
            : `${countryNames.substring(0, 35)}${countryNames.length > 35 ? '...' : ''} (${multiDetails.countries.length} countries)`;
        displaySongCount = multiDetails.totalSongCount;
        displayArtists = multiDetails.artists;
        countriesList = multiDetails.countries;
    } else {
        const singleDetails = details as SelectedCountryInfo;
        panelTitle = `${singleDetails.name} (${singleDetails.isoCode})`;
        displaySongCount = singleDetails.songCount;
        displayArtists = singleDetails.artists;
    }

    const playAllButtonText = playbackLoading === 'country-random' || playbackLoading === 'multi-country-random' 
        ? 'Starting...' 
        : 'Play All Randomly';
    
    const savePlaylistButtonText = isCreatingPlaylist ? 'Saving...' : 'Save as Playlist';

    return (
        <>
            <div
                className={`${styles.countryPanelOverlay} fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm`}
                onClick={onClose}
            />
            <div
                className={`${styles.countryPanel} fixed left-1/2 top-1/2 z-[1001] w-[90%] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-nb-md md:max-w-xl lg:p-nb-lg`}
            >
                <div className={`${styles.countryPanelHeader} flex items-center justify-between`}>
                    <h3 className="m-0 text-xl font-bold uppercase md:text-2xl">
                        {panelTitle}
                    </h3>
                    <button onClick={onClose} className={styles.countryPanelCloseButton}>
                        ×
                    </button>
                </div>

                <p className="my-nb-sm text-base">
                    Total songs from selection: <strong>{displaySongCount}</strong>
                </p>

                {isMultiView && countriesList && countriesList.length > 1 && (
                    <div className="mb-nb-sm text-xs text-nb-text/80">
                        Counts per country:
                        {countriesList.map(c => (
                            <span key={c.isoCode} className="ml-nb-xs inline-block rounded bg-nb-bg px-1 py-0.5 border border-nb-border after:content-[','] last:after:content-['']">
                                {c.name}: {c.songCount}
                            </span>
                        ))}
                    </div>
                )}

                {playbackError && <p className={`${styles.statusMessage} ${styles.error}`}>{playbackError}</p>}
                {playlistCreationStatus && (
                    <p className={`${styles.statusMessage} ${
                        playlistCreationStatus.toLowerCase().startsWith("error:") ? styles.error :
                        playlistCreationStatus.includes("created!") || playlistCreationStatus.includes("added") ? styles.success : styles.info
                    }`}>
                        {playlistCreationStatus}
                    </p>
                )}

                <div className={`${styles.countryPanelActions} my-nb-md flex flex-wrap gap-nb-sm md:gap-nb-md`}>
                    <button
                        onClick={onPlayCountryRandomly}
                        disabled={playbackLoading === 'country-random' || playbackLoading === 'multi-country-random' || displayArtists.length === 0}
                        className="btn flex-1"
                    >
                        {playAllButtonText}
                    </button>
                    <button
                        onClick={onSavePlaylist}
                        disabled={isCreatingPlaylist || displayArtists.length === 0}
                        className="btn flex-1"
                    >
                        {savePlaylistButtonText}
                    </button>
                </div>

                {displayArtists.length > 0 ? (
                    <div className={`${styles.countryPanelArtistList} max-h-[40vh] overflow-y-auto`}> {/* Added max-height and scroll for artist list */}
                        <h4 className="mt-nb-lg border-b border-nb-border/50 pb-nb-sm text-sm font-bold uppercase tracking-wider text-nb-text/80">
                            Artists & Their Songs:
                        </h4>
                        {displayArtists.map(artist => (
                            <div key={artist.name} className={`${styles.countryPanelArtistBlock} py-nb-sm`}>
                                <h5 className="mb-nb-xs text-base font-semibold text-nb-text md:text-lg">
                                    {artist.name} ({artist.songs.length} song{artist.songs.length === 1 ? '' : 's'})
                                </h5>
                                <ul className="list-none pl-0">
                                    {artist.songs.map(song => (
                                        <li key={song.id} className={`${styles.countryPanelSongItem} flex items-center justify-between py-nb-xs text-sm`}>
                                            <span className="truncate pr-nb-xs" title={song.name}>{song.name}</span>
                                            <button
                                                onClick={() => onPlaySong(song.id)}
                                                disabled={playbackLoading === song.id}
                                                className={styles.playButton}
                                                title={`Play ${song.name}`}
                                            >
                                                {playbackLoading === song.id ? '...' : '▶️'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="py-nb-md text-center text-nb-text/70">
                        No specific artists found in this selection.
                    </p>
                )}
            </div>
        </>
    );
};

export default CountryDetailsPanel;