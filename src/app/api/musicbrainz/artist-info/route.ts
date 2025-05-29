// src/app/api/musicbrainz/artist-info/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCachedArtistCountry, setCachedArtistCountry } from "@/lib/musicbrainzCache"; // Adjust path if needed
import { getCachedArtistInfoFromDB, setCachedArtistInfoInDB } from "@/lib/artistCacheService"; // Adjust path

const MUSICBRAINZ_API_BASE_URL = "http://musicbrainz.org/ws/2";
const APP_USER_AGENT = `SpotifyMapApp/0.1.0 (${process.env.NEXTAUTH_URL || 'http://localhost:3000'})`; // Use NEXTAUTH_URL or a contact email

// Helper function to introduce delay for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface MusicBrainzArtist {
    id: string; // This is the MBID
    name: string;
    country?: string; // ISO 3166-1 code (2 letters, e.g., "US", "GB")
    area?: {
        id: string;
        name: string;
        "sort-name": string;
        type?: string; // e.g., "Country", "City", "Subdivision"
        "iso-3166-1-codes"?: string[]; // For areas of type "Country"
    };
    "life-span"?: {
        begin?: string;
        ended?: boolean;
    };
    score?: number; // Search relevance score
}

interface MusicBrainzArtistSearchResponse {
    created: string;
    count: number;
    offset: number;
    artists: MusicBrainzArtist[];
}



export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const artistName = searchParams.get("artistName");

    if (!artistName) {
        return NextResponse.json({ error: "artistName query parameter is required" }, { status: 400 });
    }

    // 1. Check DB cache first
    const cachedData = await getCachedArtistInfoFromDB(artistName);
    if (cachedData) {
        // console.log(`[DB Cache HIT] MusicBrainz info for ${artistName}: ${cachedData.country}`);
        return NextResponse.json({
            artistName: artistName, // Return the original query name
            country: cachedData.country,
            mbid: cachedData.mbid,
            nameFound: cachedData.nameFound,
            source: "db_cache"
        });
    }

    // console.log(`[DB Cache MISS] Fetching MusicBrainz info for ${artistName}`);
    await delay(1100); // Ensure slightly more than 1s for safety with MusicBrainz rate limits

    try {
        const searchUrl = `${MUSICBRAINZ_API_BASE_URL}/artist/?query=artist:${encodeURIComponent(artistName)}&limit=5&fmt=json`;
        const searchResponse = await fetch(searchUrl, {
            headers: { "User-Agent": APP_USER_AGENT, "Accept": "application/json" }
        });

        if (!searchResponse.ok) {
            // ... (handle MusicBrainz API errors, but don't cache these errors long-term unless it's a definitive "not found")
            const errorText = await searchResponse.text();
            console.error(`MusicBrainz API error for "${artistName}": ${searchResponse.status} ${searchResponse.statusText}`, errorText);
            // For a 404 from MusicBrainz, you might still want to cache "not found" briefly
            // if (searchResponse.status === 404) {
            //    await setCachedArtistInfoInDB(artistName, null, null, null); // Cache "not found"
            // }
            return NextResponse.json({ error: `Failed to fetch data from MusicBrainz: ${searchResponse.statusText}` }, { status: searchResponse.status });
        }

        const searchData = (await searchResponse.json()) as MusicBrainzArtistSearchResponse;

        if (!searchData.artists || searchData.artists.length === 0) {
            await setCachedArtistInfoInDB(artistName, null, null, null); // Cache "not found"
            return NextResponse.json({ artistName, country: null, mbid: null, nameFound: null, message: "Artist not found on MusicBrainz", source: "api_not_found" });
        }

        let bestMatch: MusicBrainzArtist | undefined = searchData.artists.find(a => a.name.toLowerCase() === artistName.toLowerCase());
        if (!bestMatch && searchData.artists.length > 0) {
            bestMatch = searchData.artists.sort((a,b) => (b.score || 0) - (a.score || 0))[0]; // Fallback to highest score
        }
        
        if (!bestMatch) { // Should ideally not happen if artists array is not empty
            await setCachedArtistInfoInDB(artistName, null, null, null);
            return NextResponse.json({ artistName, country: null, mbid: null, nameFound: null, message: "No suitable artist match on MusicBrainz", source: "api_no_match" });
        }


        const mbid = bestMatch.id;
        const nameFound = bestMatch.name;
        let country: string | null = null;

        if (bestMatch.country) { // ISO 3166-1 alpha-2
            country = bestMatch.country.toUpperCase();
        } else if (bestMatch.area && bestMatch.area.type === "Country") {
            if (bestMatch.area["iso-3166-1-codes"] && bestMatch.area["iso-3166-1-codes"].length > 0) {
                country = bestMatch.area["iso-3166-1-codes"][0].toUpperCase(); // Use the first ISO code
            } else {
                // Less ideal: use area name if ISO codes are missing, but this might not be an ISO code
                // For consistency, try to map full names to ISO codes if possible, or decide if you accept full names.
                // For now, we prioritize ISO codes.
                // console.warn(`Artist ${nameFound} area ${bestMatch.area.name} is a Country but has no ISO-3166-1 codes.`);
            }
        }
        
        await setCachedArtistInfoInDB(artistName, country, mbid, nameFound);

        return NextResponse.json({
            artistName: artistName,
            country: country,
            mbid: mbid,
            nameFound: nameFound,
            source: "api_fetched"
        });

    } catch (error) {
        console.error(`Error processing MusicBrainz request for "${artistName}":`, error);
        return NextResponse.json({ error: "Internal server error processing MusicBrainz request" }, { status: 500 });
    }
}