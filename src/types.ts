// src/types.ts

// --- Spotify Data Types ---
export interface Artist {
    id: string;
    name: string;
    external_urls?: { spotify: string }; // Optional as not always used directly
  }
  
  export interface AlbumImage {
    url: string;
    height?: number; // Optional
    width?: number;  // Optional
  }
  
  export interface Album {
    id: string;
    name: string;
    images: AlbumImage[];
    external_urls?: { spotify: string }; // Optional
  }
  
  export interface Track {
    id: string;
    name: string;
    artists: Artist[];
    album: Album;
    external_urls?: { spotify: string }; // Optional
    preview_url?: string | null;       // Optional
    uri?: string; // Often useful: spotify:track:TRACK_ID
  }
  
  export interface LikedSongItem {
    added_at: string;
    track: Track;
  }
  
  export interface PlaylistItem {
    id: string;
    name: string;
    description?: string;
    owner?: { display_name?: string; id: string; };
    images?: SpotifyPlaylistImage[]; // Using specific type if different
    tracks: {
      href?: string;
      total: number;
    };
    public?: boolean;
    collaborative?: boolean;
    external_urls?: { spotify: string };
  }
  // Specific type for playlist images if needed, or reuse AlbumImage
  export interface SpotifyPlaylistImage {
      url: string;
      height: number | null;
      width: number | null;
  }
  
  
  export interface PlaylistTrackItem {
    added_at: string;
    added_by?: { id: string; type?: string; uri?: string; }; // Optional
    is_local?: boolean; // Optional
    track: Track; // Assuming track is not null after filtering in API route
  }
  
  // --- MusicBrainz API Related Types (from your backend to frontend) ---
  export interface ArtistInfoFromAPI {
    artistName: string;      // The original query name
    country: string | null;
    mbid: string | null;
    nameFound: string | null;  // Actual name found on MusicBrainz
    source: "db_cache" | "api_fetched" | "api_not_found" | "api_no_match"; // To know where it came from
  }
  
  // --- UI Specific Types ---
  export interface ArtistDetail { // For the Country Details Panel
    name: string;
    songs: Array<{ id: string; name: string }>; // Simplified song info for the panel
  }
  
  export interface SelectedCountryInfo { // For the Country Details Panel
    isoCode: string;
    name: string;
    songCount: number;
    artists: ArtistDetail[];
  }
  
  export interface LegendItem { // For MapLegend component
    color: string;
    label: string;
  }
  
  export interface UnknownsListItem { // For the Unknowns Window
      trackName: string;
      artistName: string;
  }
  
  // --- Theme Type ---
  export type AppTheme = 'light' | 'dark';
  
  // --- You can add more specific types for API responses if needed ---
  // Example for Spotify devices (if you implement device selection)
  export interface SpotifyDevice {
      id: string | null; // Can be null
      is_active: boolean;
      is_private_session: boolean;
      is_restricted: boolean;
      name: string;
      type: string; // e.g., "Computer", "Smartphone", "Speaker"
      volume_percent: number | null; // Can be null
  }
  
  export interface SpotifyDevicesResponse {
      devices: SpotifyDevice[];
  }