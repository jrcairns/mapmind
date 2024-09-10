import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const APP_CLIENT_SECRET = process.env.APP_CLIENT_SECRET!;

if (!APP_CLIENT_SECRET) {
    throw new Error('APP_CLIENT_SECRET is not set');
}

function sha1(data: Buffer, secret: string): string {
    return crypto.createHmac('sha1', secret).update(data).digest('hex');
}

export async function POST(request: NextRequest) {
    console.log("WEBHOOK FROM VERCEL")
    const rawBody = await request.text();
    const rawBodyBuffer = Buffer.from(rawBody, 'utf-8');
    const bodySignature = sha1(rawBodyBuffer, APP_CLIENT_SECRET);

    if (bodySignature !== request.headers.get('x-vercel-signature')) {
        return NextResponse.json({
            code: 'invalid_signature',
            error: "signature didn't match",
        }, { status: 401 });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch (error) {
        console.error('Error parsing webhook payload:', error);
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    try {
        // Store the webhook event in the database
        await prisma.deploymentEvent.create({
            data: {
                type: payload.type,
                deploymentId: payload.payload.deployment.id,
                status: payload.type.split('.')[1], // Extract status from event type
                metadataJson: JSON.stringify(payload), // Store the entire payload as a JSON string
            },
        });

        // You could emit a server-sent event here to notify the client

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
    }
}