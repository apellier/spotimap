// src/components/CountryDetailsPanel.tsx
"use client";

import React from 'react';
import { SelectedCountryInfo, MultiCountryDisplayInfo, ArtistDetail } from '@/types';
import { XMarkIcon, MusicalNoteIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface CountryDetailsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    details: SelectedCountryInfo | MultiCountryDisplayInfo | null;
}

const CountryDetailsPanel: React.FC<CountryDetailsPanelProps> = ({
    isOpen,
    onClose,
    details,
}) => {
    if (!isOpen || !details) {
        return null;
    }

    const isMultiView = 'countries' in details && Array.isArray(details.countries);

    let panelTitle: string;
    let displaySongCount: number;
    let displayArtists: ArtistDetail[];
    let countriesList: Array<{ isoCode: string; name: string; songCount: number }> | null = null;

    if (isMultiView) {
        const multiDetails = details as MultiCountryDisplayInfo;
        const countryNames = multiDetails.countries.map(c => c.name).join(', ');
        panelTitle = multiDetails.countries.length === 1
            ? `${multiDetails.countries[0].name}`
            : `Selected (${multiDetails.countries.length})`;
        displaySongCount = multiDetails.totalSongCount;
        displayArtists = multiDetails.artists;
        countriesList = multiDetails.countries;
    } else {
        const singleDetails = details as SelectedCountryInfo;
        panelTitle = singleDetails.name;
        displaySongCount = singleDetails.songCount;
        displayArtists = singleDetails.artists;
    }

    // State for recommendations
    const [recommendations, setRecommendations] = React.useState<any[]>([]);
    const [loadingRecs, setLoadingRecs] = React.useState(false);

    // Reset recommendations when panel acts on different country/details change
    React.useEffect(() => {
        setRecommendations([]);
    }, [details]);

    // Derived: check if we have user data
    const hasUserData = displayArtists.length > 0;

    // Fetch recommendations if no user data and it's a single country view
    React.useEffect(() => {
        if (!isOpen || isMultiView || hasUserData) return;

        // If it's a single country without songs, fetch recommendations
        if (details && !hasUserData) {
            const singleDetails = details as SelectedCountryInfo;
            const iso = singleDetails.isoCode;

            async function fetchRecs() {
                setLoadingRecs(true);
                try {
                    const res = await fetch(`/api/musicbrainz/recommendations?country=${iso}`);
                    if (res.ok) {
                        const data = await res.json();
                        setRecommendations(data.artists || []);
                    }
                } catch (e) {
                    console.error("Failed to fetch recommendations", e);
                } finally {
                    setLoadingRecs(false);
                }
            }

            fetchRecs();
        }
    }, [isOpen, hasUserData, isMultiView, details]);


    return (
        <div className="fixed top-0 right-0 bottom-0 z-[900] w-80 bg-nb-bg border-l border-nb-border shadow-nb flex flex-col pt-16 animate-in slide-in-from-right-4">

            {/* Header */}
            <div className="p-4 border-b border-nb-border flex items-center justify-between bg-nb-bg">
                <div>
                    <h3 className="text-xl font-bold uppercase text-nb-text leading-tight">
                        {panelTitle}
                    </h3>
                    <p className="text-sm text-nb-text/70 mt-1 flex items-center gap-1">
                        <MusicalNoteIcon className="w-3 h-3" />
                        {hasUserData ? `${displaySongCount} Songs` : 'No songs yet'}
                    </p>
                </div>
                <button onClick={onClose} className="btn btn-icon w-8 h-8 flex items-center justify-center">
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                {isMultiView && countriesList && countriesList.length > 1 && (
                    <div className="mb-4">
                        <p className="text-xs font-bold uppercase text-nb-text/50 mb-2">Countries</p>
                        <div className="flex flex-wrap gap-1">
                            {countriesList.map(c => (
                                <span key={c.isoCode} className="text-xs bg-nb-bg-alt px-2 py-1 rounded border border-nb-border">
                                    {c.name} <span className="text-nb-text/50">({c.songCount})</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {hasUserData ? (
                    <div className="space-y-4">
                        {displayArtists.map(artist => (
                            <div key={artist.name} className="border-b border-nb-border/30 pb-2 last:border-0">
                                <h5 className="text-sm font-bold text-nb-text mb-1">
                                    {artist.name} <span className="text-xs font-normal text-nb-text/60">({artist.songs.length})</span>
                                </h5>
                                <ul className="space-y-1">
                                    {artist.songs.map(song => (
                                        <li key={song.id} className="text-xs text-nb-text/80 truncate pl-2 border-l-2 border-nb-border/30 flex items-center justify-between group">
                                            <span className="truncate">{song.name}</span>
                                            <a
                                                href={`https://open.spotify.com/track/${song.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hidden group-hover:flex items-center gap-1 text-[10px] text-nb-accent font-bold uppercase hover:underline ml-2 flex-shrink-0"
                                                title="Open in Spotify"
                                            >
                                                Open <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-nb-text/50 text-sm">
                        <p className="italic mb-4">You haven't listened to any artists from here yet.</p>

                        {!isMultiView && (
                            <div className="mt-6 border-t border-nb-border/30 pt-4 text-left">
                                <h4 className="text-sm font-bold uppercase mb-3 flex items-center gap-2">
                                    <span>🔭</span> SpotiMap Suggests
                                </h4>

                                {loadingRecs ? (
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-4 bg-nb-border/20 rounded w-3/4"></div>
                                        <div className="h-4 bg-nb-border/20 rounded w-1/2"></div>
                                    </div>
                                ) : recommendations.length > 0 ? (
                                    <ul className="space-y-3">
                                        {recommendations.map((rec: any) => (
                                            <li key={rec.id} className="flex flex-col">
                                                <span className="font-semibold text-nb-text">{rec.name}</span>
                                                <span className="text-[10px] text-nb-text/60 truncate">
                                                    {rec.tags.slice(0, 3).join(', ')}
                                                </span>
                                                <a
                                                    href={`https://open.spotify.com/search/${encodeURIComponent(rec.name)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] text-nb-accent mt-0.5 hover:underline flex items-center gap-1"
                                                >
                                                    Find on Spotify <ArrowTopRightOnSquareIcon className="w-2.5 h-2.5" />
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs">No recommendations found.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CountryDetailsPanel;