// src/app/api/musicbrainz/batch-artist-info/route.ts
import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE_VALIDITY_DAYS } from '@/lib/artistCacheService'

interface ArtistInfo {
    country: string | null;
    mbid: string | null;
    nameFound: string | null;
    artistNameQuery?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { artistNames } = body;

        if (!artistNames || !Array.isArray(artistNames) || artistNames.some(name => typeof name !== 'string')) {
            return NextResponse.json({ error: "artistNames array of strings is required" }, { status: 400 });
        }

        if (artistNames.length === 0) {
            return NextResponse.json({});
        }

        const lowerCaseArtistNames = artistNames.map(name => name.toLowerCase());
        
        const now = new Date();
        const staleDate = new Date();
        staleDate.setDate(now.getDate() - CACHE_VALIDITY_DAYS);

        const cachedEntries = await prisma.artistCache.findMany({
            where: {
                artistNameQuery: {
                    in: lowerCaseArtistNames
                },
                lastFetched: { // Only return non-stale entries
                    gte: staleDate
                }
            }
        });

        const results: Record<string, ArtistInfo> = {};
        cachedEntries.forEach(entry => {
            results[entry.artistNameQuery] = {
                country: entry.countryCode,
                mbid: entry.mbid,
                nameFound: entry.nameFound
            };
        });

        return NextResponse.json(results);

    } catch (error: any) {
        console.error("Error fetching batch artist info from DB:", error);
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error processing batch artist info" }, { status: 500 });
    }
}