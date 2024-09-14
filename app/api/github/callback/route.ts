import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const installationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action');

    if (setupAction !== 'install' || !installationId) {
        return NextResponse.redirect(`${BASE_URL}/dashboard?error=invalid_installation`);
    }

    const { userId } = auth();

    if (!userId) {
        return NextResponse.redirect(`${BASE_URL}/dashboard?error=unauthorized`);
    }

    console.log({ installationId })
    try {
        await db.user.update({
            where: { clerkId: userId },
            data: { githubInstallationId: parseInt(installationId) },
        });

        return NextResponse.redirect(`${BASE_URL}/dashboard?success=github_installed`);
    } catch (error) {
        console.error('Error saving GitHub installation:', error);
        return NextResponse.redirect(`${BASE_URL}/dashboard?error=installation_save_failed`);
    }
}