import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const installationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action');

    if (setupAction !== 'install' || !installationId) {
        return NextResponse.redirect(`${BASE_URL}/onboarding?error=invalid_installation`);
    }

    const user = await currentUser();

    const userId = user?.id;

    if (!userId) {
        return NextResponse.redirect(`${BASE_URL}/onboarding?error=unauthorized`);
    }

    try {
        await db.user.upsert({
            where: { clerkId: userId },
            update: { githubInstallationId: parseInt(installationId) },
            create: {
                clerkId: userId,
                email: user.primaryEmailAddress?.emailAddress!,
                githubInstallationId: parseInt(installationId)
            },
        });

        return NextResponse.redirect(`${BASE_URL}/onboarding?success=github_installed`);
    } catch (error) {
        console.error('Error saving GitHub installation:', error);
        return NextResponse.redirect(`${BASE_URL}/onboarding?error=installation_save_failed`);
    }
}