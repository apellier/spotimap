// src/lib/musicbrainzCache.ts

// Simple in-memory cache for MusicBrainz artist data
// Stores: artistName (lowercase) -> { country: string | null, mbid: string, lastChecked: number }
// We can enhance this to store more structured data if needed.

interface CachedArtistInfo {
    country: string | null;
    mbid: string | null; // MusicBrainz ID
    nameFound: string | null; // Actual name found on MusicBrainz
    lastFetched: number; // Timestamp of when this was fetched
}

const artistCache = new Map<string, CachedArtistInfo>();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // Cache for 24 hours

export function getCachedArtistCountry(artistName: string): CachedArtistInfo | undefined {
    const key = artistName.toLowerCase();
    const cached = artistCache.get(key);
    if (cached && (Date.now() - cached.lastFetched < CACHE_DURATION_MS)) {
        return cached;
    }
    if (cached) { // Cache expired
        artistCache.delete(key);
    }
    return undefined;
}

export function setCachedArtistCountry(
    artistName: string,
    country: string | null,
    mbid: string | null,
    nameFound: string | null
): void {
    const key = artistName.toLowerCase();
    artistCache.set(key, { country, mbid, nameFound, lastFetched: Date.now() });
}

// For debugging or admin purposes, you might want a way to view or clear the cache
export function getCacheSize(): number {
    return artistCache.size;
}

export function clearCache(): void {
    artistCache.clear();
    console.log("MusicBrainz artist cache cleared.");
}