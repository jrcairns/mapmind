import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const latestEvent = await prisma.deploymentEvent.findFirst({
            orderBy: { createdAt: 'desc' },
        });

        if (!latestEvent) {
            return NextResponse.json({ message: 'No deployment events found' }, { status: 404 });
        }

        // Parse the JSON metadata
        const metadata = JSON.parse(latestEvent.metadataJson);

        return NextResponse.json({
            ...latestEvent,
            metadata,
        });
    } catch (error) {
        console.error('Error fetching latest deployment event:', error);
        return NextResponse.json({ error: 'Failed to fetch latest deployment event' }, { status: 500 });
    }
}