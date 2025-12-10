
import { SpotifyTrack } from '@/types';

// Helper function to get unique artists
export const getUniqueFirstArtistsFromTracks = (tracks: Array<{ track: SpotifyTrack }>): string[] => {
    const firstArtists = new Set<string>();
    tracks.forEach(item => {
        if (item.track?.artists && item.track.artists.length > 0) {
            const firstArtist = item.track.artists[0];
            if (firstArtist?.name) firstArtists.add(firstArtist.name.toLowerCase());
        }
    });
    return Array.from(firstArtists);
};
