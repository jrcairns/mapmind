import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { EventEmitter } from 'events';

const APP_CLIENT_SECRET = process.env.APP_CLIENT_SECRET!;

if (!APP_CLIENT_SECRET) {
    throw new Error('APP_CLIENT_SECRET is not set');
}

function sha1(data: Buffer, secret: string): string {
    return crypto.createHmac('sha1', secret).update(data).digest('hex');
}

// Create a global event emitter
const eventEmitter = new EventEmitter();

interface DeploymentEvent {
    type: string;
    payload: {
        deployment: {
            id: string;
            // Add other properties as needed
        };
        // Add other properties as needed
    };
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

    let payload: DeploymentEvent;
    try {
        payload = JSON.parse(rawBody);
    } catch (error) {
        console.error('Error parsing webhook payload:', error);
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Emit the event
    eventEmitter.emit('deploymentUpdate', payload);

    return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // Send headers for SSE
    const response = new NextResponse(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });

    const sendEvent = async (event: DeploymentEvent) => {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    };

    // Listen for deployment updates
    const listener = (event: DeploymentEvent) => {
        sendEvent(event);
    };

    eventEmitter.on('deploymentUpdate', listener);

    // Keep the connection alive
    const intervalId = setInterval(() => {
        sendEvent({ type: 'ping', payload: { deployment: { id: 'ping' } } });
    }, 30000);

    // Clean up on client disconnect
    request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        eventEmitter.off('deploymentUpdate', listener);
        writer.close();
    });

    return response;
}