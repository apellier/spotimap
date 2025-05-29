// src/lib/artistCacheService.ts (or modify musicbrainzCache.ts)
import prisma from './prisma'; // Your Prisma client instance
import { ArtistCache } from '@prisma/client'; // Import the generated type

const CACHE_VALIDITY_DAYS = 30; // Example: Re-fetch data older than 30 days

interface CachedArtistInfoDB {
    country: string | null;
    mbid: string | null;
    nameFound: string | null;
}

export async function getCachedArtistInfoFromDB(artistNameQuery: string): Promise<CachedArtistInfoDB | null> {
    const queryKey = artistNameQuery.toLowerCase();
    try {
        const cachedEntry = await prisma.artistCache.findUnique({
            where: { artistNameQuery: queryKey },
        });

        if (cachedEntry) {
            const ageInDays = (Date.now() - new Date(cachedEntry.lastFetched).getTime()) / (1000 * 60 * 60 * 24);
            if (ageInDays < CACHE_VALIDITY_DAYS) {
                return {
                    country: cachedEntry.countryCode,
                    mbid: cachedEntry.mbid,
                    nameFound: cachedEntry.nameFound,
                };
            } else {
                // Cache entry is stale, could delete it or mark for re-fetch
                // console.log(`Cache stale for ${artistNameQuery}, will re-fetch.`);
                // await prisma.artistCache.delete({ where: { artistNameQuery: queryKey }}); // Optional: delete stale entry
                return null;
            }
        }
        return null;
    } catch (error) {
        console.error("Error fetching from DB cache:", error);
        return null; // On error, act as cache miss
    }
}

export async function setCachedArtistInfoInDB(
    artistNameQuery: string,
    country: string | null,
    mbid: string | null,
    nameFound: string | null
): Promise<void> {
    const queryKey = artistNameQuery.toLowerCase();
    try {
        await prisma.artistCache.upsert({
            where: { artistNameQuery: queryKey },
            update: {
                countryCode: country,
                mbid: mbid,
                nameFound: nameFound,
                lastFetched: new Date(), // This will be set automatically by @updatedAt
            },
            create: {
                artistNameQuery: queryKey,
                countryCode: country,
                mbid: mbid,
                nameFound: nameFound,
                // lastFetched is set by @default(now()) on create and @updatedAt on update
            },
        });
    } catch (error) {
        console.error("Error saving to DB cache:", error);
    }
}