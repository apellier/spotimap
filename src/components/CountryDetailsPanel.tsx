// src/components/CountryDetailsPanel.tsx
"use client";

import React from 'react';
import styles from '../app/page.module.css'; // Using styles from page.module.css
import { SelectedCountryInfo, ArtistDetail } from '@/types'; // Your centralized types

interface CountryDetailsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    details: SelectedCountryInfo | null;
    // Playback & Playlist Action Handlers & State
    onPlaySong: (trackId: string) => void;
    onPlayCountryRandomly: () => void;
    onSavePlaylist: () => void;
    playbackLoading: string | null; // trackId or 'country-random'
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

    return (
        <>
            <div
                className={`${styles.countryPanelOverlay} fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm`} // Tailwind for overlay
                onClick={onClose}
            />
            <div
                className={`${styles.countryPanel} fixed left-1/2 top-1/2 z-[1001] w-[90%] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-nb-md md:max-w-xl lg:p-nb-lg`} // page.module.css + Tailwind
            >
                <div className={`${styles.countryPanelHeader} flex items-center justify-between`}>
                    <h3 className="m-0 text-xl font-bold uppercase md:text-2xl"> {/* Tailwind */}
                        {details.name} ({details.isoCode})
                    </h3>
                    <button onClick={onClose} className={styles.countryPanelCloseButton}>
                        ×
                    </button>
                </div>

                <p className="my-nb-sm text-base"> {/* Tailwind */}
                    Total songs from current selection: <strong>{details.songCount}</strong>
                </p>

                {/* Status Messages for Playback/Playlist */}
                {playbackError && <p className={`${styles.statusMessage} ${styles.error}`}>{playbackError}</p>}
                {playlistCreationStatus && (
                    <p className={`${styles.statusMessage} ${
                        playlistCreationStatus.startsWith("Error:") ? styles.error :
                        playlistCreationStatus.includes("created!") || playlistCreationStatus.includes("added") ? styles.success : styles.info
                    }`}>
                        {playlistCreationStatus}
                    </p>
                )}

                <div className={`${styles.countryPanelActions} my-nb-md flex flex-wrap gap-nb-sm md:gap-nb-md`}> {/* Tailwind */}
                    <button
                        onClick={onPlayCountryRandomly}
                        disabled={playbackLoading === 'country-random' || details.artists.length === 0}
                        className="btn flex-1" // Global .btn style
                    >
                        {playbackLoading === 'country-random' ? 'Starting...' : 'Play All Randomly'}
                    </button>
                    <button
                        onClick={onSavePlaylist}
                        disabled={isCreatingPlaylist || details.artists.length === 0}
                        className="btn flex-1" // Global .btn style
                    >
                        {isCreatingPlaylist ? 'Saving...' : 'Save as Playlist'}
                    </button>
                </div>

                {details.artists.length > 0 ? (
                    <div className={styles.countryPanelArtistList}>
                        <h4 className="mt-nb-lg border-b border-nb-stroke/50 pb-nb-sm text-sm font-bold uppercase tracking-wider text-nb-text/80"> {/* Tailwind */}
                            Artists & Their Songs:
                        </h4>
                        {details.artists.map(artist => (
                            <div key={artist.name} className={`${styles.countryPanelArtistBlock} py-nb-sm`}>
                                <h5 className="mb-nb-xs text-base font-semibold text-nb-text md:text-lg"> {/* Tailwind */}
                                    {artist.name} ({artist.songs.length} song(s))
                                </h5>
                                <ul className="list-none pl-0">
                                    {artist.songs.map(song => (
                                        <li key={song.id} className={`${styles.countryPanelSongItem} flex items-center justify-between py-nb-xs text-sm`}>
                                            <span>{song.name}</span>
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
                    <p className="py-nb-md text-center text-nb-text/70"> {/* Tailwind */}
                        No specific artists from this country found in the current selection.
                    </p>
                )}
            </div>
        </>
    );
};

export default CountryDetailsPanel;