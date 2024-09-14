import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function POST() {
    const { userId } = auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            select: { githubInstallationId: true, vercelAccessToken: true },
        });

        if (!user?.githubInstallationId || !user?.vercelAccessToken) {
            return NextResponse.json({ error: 'Integrations not complete' }, { status: 400 });
        }

        // If we reach here, both integrations are complete
        const response = NextResponse.json({ success: true });

        // Set the cookie
        response.cookies.set('onboarding_complete', 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Error completing onboarding:', error);
        return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
    }
}