// src/app/api/admin/clear-unknowns/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * This endpoint deletes all entries from the ArtistCache where the countryCode is null.
 * This effectively "invalidates" the cache for all unknown artists, forcing a new
 * lookup from MusicBrainz on their next appearance.
 */
export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { count } = await prisma.artistCache.deleteMany({
            where: {
                countryCode: null,
            },
        });

        console.log(`User ${session.user?.id} cleared ${count} unknown artist entries from the cache.`);
        
        return NextResponse.json({ 
            message: `Cleared ${count} unknown artists. Reload your playlist to re-scan them.`,
            count: count 
        });

    } catch (error) {
        console.error("Error clearing unknown artist cache:", error);
        return NextResponse.json({ error: "Internal Server Error while clearing cache" }, { status: 500 });
    }
}
