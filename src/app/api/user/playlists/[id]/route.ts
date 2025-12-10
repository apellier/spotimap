
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params if necessary (Next.js 15 requires awaiting params, but let's check config. Safe to await or treat as object in older versions)
    // Actually in updated Next.js, params is a Promise. Let's assume standard behavior for now but keep in mind.
    // Wait, the prompt said Next.js 15.3.2. PARAMS ARE PROMISES!
    const { id } = await params;

    try {
        await prisma.savedPlaylist.deleteMany({
            where: {
                id: id,
                userId: session.user.id // Security: only delete own playlist
            }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting playlist:", error);
        return NextResponse.json({ error: "Failed to delete playlist" }, { status: 500 });
    }
}
