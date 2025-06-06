// src/types.ts

// --- LEAN SPOTIFY API DATA TYPES (Single Source of Truth) ---
// These types define the minimal data we fetch from Spotify to improve performance.

/** A lean artist object from Spotify */
export interface SpotifyArtist {
  name: string;
}

/** A lean track object from Spotify, containing only the fields needed by the app */
export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: SpotifyArtist[];
}

/** An item from the "Liked Songs" list */
export interface LikedSongItem {
  added_at: string;
  track: SpotifyTrack;
}

/** An item from a specific playlist */
export interface PlaylistTrackItem {
  added_at: string;
  track: SpotifyTrack | null; // Track can be null if unavailable in a playlist
}

/** A lean playlist object for the main playlist list */
export interface PlaylistItem {
  id: string;
  name: string;
  tracks: {
    total: number;
  };
}


// --- MUSICBRAINZ API & CACHE TYPES ---
export interface ArtistInfoFromAPI {
  artistName: string;
  country: string | null;
  mbid: string | null;
  nameFound: string | null;
  source: "db_cache" | "api_fetched" | "api_not_found" | "api_no_match";
}


// --- UI & DATA AGGREGATION SPECIFIC TYPES ---
// These types are used for processing and displaying data in the frontend.

/** Detailed artist info for the country details panel */
export interface ArtistDetail {
  name: string;
  songs: Array<{ id: string; name: string }>;
}

/** Data for the panel when a single country is selected */
export interface SelectedCountryInfo {
  isoCode: string;
  name: string;
  songCount: number;
  artists: ArtistDetail[];
}

/** Basic info for tracking multi-selected countries */
export interface SelectedCountryBasicInfo {
isoCode: string;
name: string;
}

/** Data for the panel when multiple countries are selected */
export interface MultiCountryDisplayInfo {
countries: Array<SelectedCountryBasicInfo & { songCount: number }>;
totalSongCount: number;
artists: ArtistDetail[];
allTrackUris: string[];
}

/** For the map legend component */
export interface LegendItem {
  color: string;
  label: string;
}

/** For the "Unknown Origins" panel */
export interface UnknownsListItem {
  trackName: string;
  artistName: string;
}

/** For the theme context */
export type AppTheme = 'light' | 'dark';
