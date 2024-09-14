import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET() {
    const { userId } = auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            select: { vercelAccessToken: true },
        });

        return NextResponse.json({ connected: !!user?.vercelAccessToken });
    } catch (error) {
        console.error('Error checking Vercel connection:', error);
        return NextResponse.json({ error: 'Failed to check Vercel connection' }, { status: 500 });
    }
}