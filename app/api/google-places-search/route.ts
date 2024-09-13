import { NextResponse } from 'next/server'
import { Client } from "@googlemaps/google-maps-services-js"

const client = new Client({});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    try {
        const response = await client.textSearch({
            params: {
                query: query,
                key: process.env.GOOGLE_MAPS_API_KEY!,
            },
        });

        if (response.status !== 200) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const results = response.data.results.map(place => ({
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
        }));

        return NextResponse.json({ results })
    } catch (error) {
        console.error('Error searching Google Places:', error)
        return NextResponse.json({ error: 'Failed to search Google Places' }, { status: 500 })
    }
}