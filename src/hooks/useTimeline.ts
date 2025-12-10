"use client";

import { useState, useMemo, useEffect } from 'react';
import { useSpotifyContext } from '@/contexts/SpotifyContext';
import { useMapContext } from '@/contexts/MapContext';

export function useTimeline() {
    const { currentTracks } = useSpotifyContext();
    const { artistCountries, isLoadingArtistCountries } = useMapContext();

    const [isTimelineActive, setIsTimelineActive] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [timelineFrame, setTimelineFrame] = useState(0); // The current position (index) in the timeline
    const [timelineSpeed, setTimelineSpeed] = useState(50);

    // Constants
    const MIN_TIMELINE_SPEED_MS = 10;
    const MAX_TIMELINE_SPEED_MS = 200;
    const TIMELINE_SPEED_STEP = 10;
    const BASE_SPEED_MS = 50;


    const timelineData = useMemo(() => {
        if (!isTimelineActive || isLoadingArtistCountries || currentTracks.length === 0 || artistCountries.size === 0) {
            return [];
        }

        // console.log("Preparing timeline data...");

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

        datedTracks.sort((a, b) => a.added_at.getTime() - b.added_at.getTime());

        return datedTracks;

    }, [isTimelineActive, currentTracks, artistCountries, isLoadingArtistCountries]);

    // Calculate map counts based on the current timeline frame
    const timelineMapCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (!isTimelineActive || timelineData.length === 0) {
            return counts;
        }

        const frameSlice = timelineData.slice(0, timelineFrame);

        frameSlice.forEach(track => {
            counts.set(track.country, (counts.get(track.country) || 0) + 1);
        });

        return counts;
    }, [isTimelineActive, timelineFrame, timelineData]);

    useEffect(() => {
        if (!isPlaying || !isTimelineActive) {
            return;
        }

        const timer = setInterval(() => {
            setTimelineFrame(prevFrame => {
                if (prevFrame >= timelineData.length) {
                    setIsPlaying(false);
                    return prevFrame;
                }
                return prevFrame + 1;
            });
        }, timelineSpeed);

        return () => clearInterval(timer);
    }, [isPlaying, isTimelineActive, timelineData.length, timelineSpeed]);

    const handleChangeSpeed = (direction: 'increase' | 'decrease') => {
        setTimelineSpeed(currentSpeed => {
            if (direction === 'increase') {
                return Math.max(MIN_TIMELINE_SPEED_MS, currentSpeed - TIMELINE_SPEED_STEP);
            } else {
                return Math.min(MAX_TIMELINE_SPEED_MS, currentSpeed + TIMELINE_SPEED_STEP);
            }
        });
    };

    return {
        isTimelineActive,
        setIsTimelineActive,
        isPlaying,
        setIsPlaying,
        timelineFrame,
        setTimelineFrame,
        timelineSpeed,
        handleChangeSpeed,
        timelineData,
        timelineMapCounts,
        minSpeed: MIN_TIMELINE_SPEED_MS,
        maxSpeed: MAX_TIMELINE_SPEED_MS,
        baseSpeed: BASE_SPEED_MS
    };
}
