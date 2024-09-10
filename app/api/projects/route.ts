import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { decrypt } from '@/app/lib/crypto';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD!;

export async function GET() {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await db.user.findUnique({
            where: { clerkId: user.id },
        });

        if (!dbUser || !dbUser.vercelAccessToken) {
            return NextResponse.json({ error: 'Vercel account not connected' }, { status: 400 });
        }

        const decryptedToken = await decrypt(dbUser.vercelAccessToken, MASTER_PASSWORD);

        const vercelResponse = await fetch('https://api.vercel.com/v9/projects', {
            headers: {
                Authorization: `Bearer ${decryptedToken}`,
            },
        });

        if (!vercelResponse.ok) {
            throw new Error('Failed to fetch projects from Vercel');
        }

        const projects = await vercelResponse.json();

        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}