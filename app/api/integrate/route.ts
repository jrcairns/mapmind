import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/app/lib/crypto';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD!;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!MASTER_PASSWORD) {
    throw new Error('MASTER_PASSWORD is not set');
}

async function createVercelToken(accessToken: string): Promise<string | null> {
    try {
        const response = await fetch(`https://api.vercel.com/v3/user/tokens`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `Integration Token ${new Date().toISOString()}`,
                expiresAt: null // This creates a non-expiring token. Adjust as needed.
            }),
        });

        if (!response.ok) {
            console.error('Failed to create Vercel token:', await response.text());
            return null;
        }

        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error('Error creating Vercel token:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { accessToken } = await request.json();

        if (!accessToken) {
            return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
        }

        // Create a new Vercel token
        const newToken = await createVercelToken(accessToken);

        if (!newToken) {
            return NextResponse.json({ error: 'Failed to create Vercel token' }, { status: 400 });
        }

        const encryptedToken = await encrypt(newToken, MASTER_PASSWORD);

        // Store the encrypted token in the database
        await prisma.user.update({
            where: { clerkId: userId },
            data: {
                vercelAccessToken: encryptedToken,
                vercelTeamId: VERCEL_TEAM_ID || null,
            },
        });

        return NextResponse.json({ message: 'Vercel account integrated successfully' });
    } catch (error) {
        console.error('Error integrating Vercel account:', error);
        return NextResponse.json({ error: 'Failed to integrate Vercel account' }, { status: 500 });
    }
}