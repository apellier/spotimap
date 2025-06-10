// src/app/api/musicbrainz/artist-info/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCachedArtistInfoFromDB, setCachedArtistInfoInDB } from "@/lib/artistCacheService";

const MUSICBRAINZ_API_BASE_URL = "http://musicbrainz.org/ws/2";
const APP_USER_AGENT = `SpotifyMapApp/0.1.0 (${process.env.NEXTAUTH_URL || 'http://localhost:3000'})`;

// --- HELPER TYPES FOR MUSICBRAINZ API ---
interface MBArea {
    id: string; // MBID for the area
    name: string;
    "sort-name": string;
    type?: string; // e.g., "Country", "City", "Subdivision"
    "iso-3166-1-codes"?: string[];
    "life-span"?: { ended: boolean | null };
    relations?: MBRelation[];
}

interface MBRelation {
    type: string; // e.g., "part of"
    direction: "backward" | "forward";
    area: MBArea;
}

interface MBArtist {
    id: string;
    name: string;
    country?: string; // ISO 3166-1 code
    area?: MBArea;
    "begin-area"?: MBArea;
    "life-span"?: { ended: boolean | null };
    score?: number;
}

interface MusicBrainzArtistSearchResponse {
    artists: MBArtist[];
}

// Helper function to introduce a delay for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Traverses up the MusicBrainz area hierarchy to find the parent country.
 * e.g., "Philadelphia" -> "Pennsylvania" -> "United States"
 * @param areaId The MusicBrainz ID (MBID) of the starting area (e.g., a city).
 * @param depth Internal counter to prevent infinite loops.
 * @returns The ISO 3166-1 country code (e.g., "US") or null if not found.
 */
async function findCountryInHierarchy(areaId: string, depth = 0): Promise<string | null> {
    // Safety break to prevent infinite recursion on malformed data
    if (depth > 5) {
        console.warn(`Reached max hierarchy depth for area ${areaId}. Aborting lookup.`);
        return null;
    }

    // Add a small delay for this supplemental API call to be safe
    await delay(500);
    
    const url = `${MUSICBRAINZ_API_BASE_URL}/area/${areaId}?inc=area-rels&fmt=json`;
    const response = await fetch(url, { headers: { "User-Agent": APP_USER_AGENT } });
    if (!response.ok) return null;

    const areaData: MBArea = await response.json();

    // The area itself might be a country (e.g., "England" might resolve to an area with iso-3166-1-codes)
    if (areaData.type === "Country" && areaData["iso-3166-1-codes"]?.length) {
        return areaData["iso-3166-1-codes"][0];
    }

    // Find the "part of" relationship that points upwards in the hierarchy
    const parentRelation = areaData.relations?.find(
        rel => rel.type === "part of" && rel.direction === "backward"
    );

    if (parentRelation?.area) {
        const parentArea = parentRelation.area;
        // If the parent is a country, we're done!
        if (parentArea.type === "Country" && parentArea["iso-3166-1-codes"]?.length) {
            return parentArea["iso-3166-1-codes"][0];
        }
        // Otherwise, recurse to check the parent's parent
        return findCountryInHierarchy(parentArea.id, depth + 1);
    }
    
    return null;
}

/**
 * Gets the final country code from an area, traversing the hierarchy if necessary.
 * @param area The MBArea object from an artist.
 * @returns The ISO 3166-1 country code or null.
 */
async function getCountryFromArea(area?: MBArea): Promise<string | null> {
    if (!area) return null;

    // Case 1: The area itself is a country with a valid ISO code.
    if (area.type === "Country" && area["iso-3166-1-codes"]?.length) {
        return area["iso-3166-1-codes"][0];
    }
    
    // Case 2: The area is a subdivision, city, etc., so we need to look up its parent.
    return await findCountryInHierarchy(area.id);
}


// --- MAIN API ROUTE ---
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const artistName = searchParams.get("artistName");

    if (!artistName) {
        return NextResponse.json({ error: "artistName query parameter is required" }, { status: 400 });
    }

    // 1. Check DB cache first
    const cachedData = await getCachedArtistInfoFromDB(artistName);
    if (cachedData) {
        return NextResponse.json({
            artistName,
            country: cachedData.country,
            mbid: cachedData.mbid,
            nameFound: cachedData.nameFound,
            source: "db_cache"
        });
    }

    // 2. If not in cache, fetch from MusicBrainz
    console.log(`[MusicBrainz API] Fetching info for ${artistName}`);
    await delay(1100); // Main rate-limiting delay for the search endpoint

    try {
        const searchUrl = `${MUSICBRAINZ_API_BASE_URL}/artist/?query=artist:${encodeURIComponent(artistName)}&limit=5&fmt=json`;
        const searchResponse = await fetch(searchUrl, { headers: { "User-Agent": APP_USER_AGENT } });
        if (!searchResponse.ok) throw new Error(`MusicBrainz API error: ${searchResponse.status}`);
        
        const searchData: MusicBrainzArtistSearchResponse = await searchResponse.json();
        if (!searchData.artists || searchData.artists.length === 0) {
            await setCachedArtistInfoInDB(artistName, null, null, null); // Cache "not found"
            return NextResponse.json({ artistName, country: null, mbid: null, nameFound: null, source: "api_not_found" });
        }

        // Find the best artist match (your existing logic is good)
        let bestMatch = searchData.artists.find(a => a.name.toLowerCase() === artistName.toLowerCase());
        if (!bestMatch) bestMatch = searchData.artists.sort((a,b) => (b.score || 0) - (a.score || 0))[0];
        if (!bestMatch) {
             await setCachedArtistInfoInDB(artistName, null, null, null);
             return NextResponse.json({ artistName, country: null, mbid: null, nameFound: null, source: "api_no_match" });
        }

        const { id: mbid, name: nameFound } = bestMatch;
        let finalCountry: string | null = null;
        
        // --- NEW DATA QUALITY LOGIC ---
        // Priority 1: Check the 'country' field directly (most reliable)
        if (bestMatch.country) {
            finalCountry = bestMatch.country;
        }
        // Priority 2: Check the 'area' field and traverse its hierarchy if needed
        else if (bestMatch.area) {
            finalCountry = await getCountryFromArea(bestMatch.area);
        }
        // Priority 3: As a fallback, check the 'begin-area' field
        else if (bestMatch["begin-area"]) {
            finalCountry = await getCountryFromArea(bestMatch["begin-area"]);
        }

        // 3. Cache the final, cleaned result in the database
        await setCachedArtistInfoInDB(artistName, finalCountry, mbid, nameFound);

        return NextResponse.json({
            artistName: artistName,
            country: finalCountry,
            mbid: mbid,
            nameFound: nameFound,
            source: "api_fetched"
        });

    } catch (error) {
        console.error(`Error processing MusicBrainz request for "${artistName}":`, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
