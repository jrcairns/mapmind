import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/app/lib/crypto';

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID!;
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET!;
const MASTER_PASSWORD = process.env.MASTER_PASSWORD!;

if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET || !MASTER_PASSWORD) {
    throw new Error('Missing required environment variables');
}

if (!VERCEL_CLIENT_SECRET) {
    throw new Error('VERCEL_CLIENT_SECRET is not set');
}

export async function GET(request: NextRequest) {
    const clerk = await currentUser();

    if (!clerk) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = clerk.id

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const configurationId = searchParams.get('configurationId');
    const next = searchParams.get('next');

    if (!code) {
        return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
    }

    try {
        // Exchange the code for an access token
        const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: VERCEL_CLIENT_ID,
                client_secret: VERCEL_CLIENT_SECRET,
                code,
                redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/integrations/vercel/callback`,
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to exchange code for token');
        }

        const { access_token, team_id } = await tokenResponse.json();

        // Encrypt the access token
        const encryptedToken = await encrypt(access_token, MASTER_PASSWORD);

        // Upsert the user record with the encrypted token and other relevant information
        await prisma.user.upsert({
            where: { clerkId: userId },
            update: {
                vercelAccessToken: encryptedToken,
                vercelTeamId: team_id || null,
                vercelConfigurationId: configurationId || null,
            },
            create: {
                clerkId: userId,
                email: clerk.primaryEmailAddress?.emailAddress || '',
                vercelAccessToken: encryptedToken,
                vercelTeamId: team_id || null,
                vercelConfigurationId: configurationId || null,
            },
        });

        // Redirect to the next URL or dashboard
        const redirectUrl = next || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?integration=success`;
        return NextResponse.redirect(redirectUrl);
    } catch (error) {
        console.error('Error in Vercel callback:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?integration=error`);
    }
}