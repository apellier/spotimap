// src/utils/localStorageUtils.ts

const PLAYLISTS_KEY = 'spotimap_playlists';

export interface SavedPlaylist {
    id: string; // Spotify playlist ID
    name: string;
    url: string; // Original URL used to add
    addedAt: string; // ISO date string
}

/**
 * Get all saved playlists from localStorage
 */
export function getSavedPlaylists(): SavedPlaylist[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(PLAYLISTS_KEY);
        if (!stored) return [];
        return JSON.parse(stored) as SavedPlaylist[];
    } catch (e) {
        console.error('Failed to parse saved playlists', e);
        return [];
    }
}

/**
 * Save a playlist to localStorage
 */
export function savePlaylist(playlist: Omit<SavedPlaylist, 'addedAt'>): SavedPlaylist[] {
    const existing = getSavedPlaylists();

    // Don't add duplicates
    if (existing.some(p => p.id === playlist.id)) {
        return existing;
    }

    const newPlaylist: SavedPlaylist = {
        ...playlist,
        addedAt: new Date().toISOString()
    };

    const updated = [...existing, newPlaylist];

    try {
        localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to save playlist to localStorage', e);
    }

    return updated;
}

/**
 * Remove a playlist from localStorage by ID
 */
export function removePlaylist(playlistId: string): SavedPlaylist[] {
    const existing = getSavedPlaylists();
    const updated = existing.filter(p => p.id !== playlistId);

    try {
        localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to update localStorage after removal', e);
    }

    return updated;
}

/**
 * Clear all saved playlists
 */
export function clearAllPlaylists(): void {
    try {
        localStorage.removeItem(PLAYLISTS_KEY);
    } catch (e) {
        console.error('Failed to clear playlists', e);
    }
}
