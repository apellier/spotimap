import { NextRequest, NextResponse } from 'next/server';

const MUSICBRAINZ_API_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'SpotiMap/1.0 ( your-email@example.com )'; // Using generic user agent

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const countryIso = searchParams.get('country');

    if (!countryIso) {
        return NextResponse.json({ error: 'Country ISO code required' }, { status: 400 });
    }

    try {
        // 1. Get Area ID for the country ISO code
        // MusicBrainz allows searching for areas by ISO 3166-1 codes
        // Query: iso:US AND type:country
        const areaRes = await fetch(
            `${MUSICBRAINZ_API_BASE}/area?query=iso:${countryIso} AND type:country&fmt=json`,
            { headers: { 'User-Agent': USER_AGENT } }
        );

        if (!areaRes.ok) throw new Error('Failed to fetch area');
        const areaData = await areaRes.json();
        const area = areaData.areas?.[0];

        if (!area) {
            return NextResponse.json({ artists: [] });
        }

        // 2. Fetch Artists from this Area
        // We'll search for artists in this area. 
        // We can't easily sort by "popularity" in MB without more complex queries or external data.
        // But we can try to filter by tagging to get somewhat relevant ones.
        // Let's just get a list and maybe randomization is enough for "discovery".
        // Or we can try to find artists that are "Person" or "Group" type.
        const encodedAreaId = encodeURIComponent(area.id);
        const artistRes = await fetch(
            `${MUSICBRAINZ_API_BASE}/artist?query=area:${encodedAreaId} AND (type:Person OR type:Group)&limit=15&fmt=json`,
            { headers: { 'User-Agent': USER_AGENT } }
        );

        if (!artistRes.ok) throw new Error('Failed to fetch artists');
        const artistData = await artistRes.json();

        // Transform the data
        const artists = artistData.artists.map((artist: any) => ({
            id: artist.id,
            name: artist.name,
            disambiguation: artist.disambiguation,
            tags: artist.tags?.map((t: any) => t.name) || [],
            spotifyId: null // We don't have this yet, would need another lookup or usage of URL relations
        }));

        // Simple Random Shuffle to vary recommendations
        const shuffled = artists.sort(() => 0.5 - Math.random()).slice(0, 5);

        return NextResponse.json({ artists: shuffled });

    } catch (error) {
        console.error('MusicBrainz Recommendation Error:', error);
        return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
    }
}
