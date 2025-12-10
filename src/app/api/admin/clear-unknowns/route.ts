// src/app/api/admin/clear-unknowns/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST() {
    // No auth required for now (public usage)
    try {
        const { count } = await prisma.artistCache.deleteMany({
            where: {
                countryCode: null,
            },
        });

        console.log(`Cleared ${count} unknown artist entries from the cache.`);

        return NextResponse.json({
            message: `Cleared ${count} unknown artists. Reload your playlist to re-scan them.`,
            count: count
        });

    } catch (error) {
        console.error("Error clearing unknown artist cache:", error);
        return NextResponse.json({ error: "Internal Server Error while clearing cache" }, { status: 500 });
    }
}
