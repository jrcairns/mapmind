import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { decrypt } from '@/app/lib/crypto';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD!;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

        const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${params.id}`, {
            headers: {
                Authorization: `Bearer ${decryptedToken}`,
            },
        });

        if (!projectResponse.ok) {
            throw new Error('Failed to fetch project from Vercel');
        }

        const project = await projectResponse.json();

        return NextResponse.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
    }
}