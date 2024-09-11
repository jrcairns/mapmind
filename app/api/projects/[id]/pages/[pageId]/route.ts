import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { Client } from "@googlemaps/google-maps-services-js"

const client = new Client({});

export async function GET(request: NextRequest, { params }: { params: { id: string, pageId: string } }) {
    try {
        const user = await currentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const project = await db.project.findFirst({
            where: {
                vercelId: params.id,
                user: { clerkId: user.id }
            }
        })

        if (!project || !project.data) {
            return NextResponse.json({ error: 'Project not found or has no data' }, { status: 404 })
        }

        const pageData = (project.data as any).results.find((result: any) =>
            result.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === params.pageId
        )

        if (!pageData) {
            return NextResponse.json({ error: 'Page not found in project data' }, { status: 404 })
        }

        // Fetch detailed place information from Google Maps API
        const response = await client.placeDetails({
            params: {
                place_id: pageData.place_id,
                key: process.env.GOOGLE_MAPS_API_KEY!,
            },
        });

        if (response.status !== 200) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        return NextResponse.json(response.data.result)
    } catch (error) {
        console.error('Error fetching page details:', error)
        return NextResponse.json({ error: 'Failed to fetch page details' }, { status: 500 })
    }
}