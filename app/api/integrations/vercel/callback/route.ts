import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { encrypt } from '@/app/lib/crypto';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD!;
const APP_CLIENT_ID = process.env.APP_CLIENT_ID!;
const APP_CLIENT_SECRET = process.env.APP_CLIENT_SECRET!;

if (!MASTER_PASSWORD || !APP_CLIENT_ID || !APP_CLIENT_SECRET) {
    throw new Error('Missing required environment variables');
}

export async function GET(request: NextRequest) {
    const { userId } = auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const configurationId = searchParams.get('configurationId');
    const teamId = searchParams.get('teamId');

    if (!code) {
        return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
    }

    try {
        // Exchange the code for an access token
        const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: APP_CLIENT_ID,
                client_secret: APP_CLIENT_SECRET,
                code,
                redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/vercel/callback`,
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to exchange code for token');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Encrypt the access token
        const encryptedToken = await encrypt(accessToken, MASTER_PASSWORD);

        // Update the user in the database
        await db.user.update({
            where: { clerkId: userId },
            data: {
                vercelAccessToken: encryptedToken,
                vercelTeamId: teamId || null,
                vercelConfigurationId: configurationId || null,
            },
        });

        // Redirect to the dashboard or a success page
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`);
    } catch (error) {
        console.error('Error in Vercel integration callback:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}