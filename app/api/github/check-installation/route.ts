import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

export async function GET() {
    const { userId } = auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            select: { githubInstallationId: true },
        });

        if (user?.githubInstallationId) {
            // Verify the installation
            try {
                const octokit = new Octokit({
                    authStrategy: createAppAuth,
                    auth: {
                        appId: process.env.GITHUB_APP_ID!,
                        privateKey: process.env.GITHUB_PRIVATE_KEY!,
                        installationId: user.githubInstallationId,
                    },
                });

                await octokit.apps.getInstallation({ installation_id: user.githubInstallationId });

                // If the above doesn't throw, the installation is valid
                return NextResponse.json({ installationId: user.githubInstallationId });
            } catch (error) {
                console.error('GitHub installation is no longer valid:', error);

                // Remove the invalid installation ID from the database
                await db.user.update({
                    where: { clerkId: userId },
                    data: { githubInstallationId: null },
                });

                return NextResponse.json({ installationId: null });
            }
        } else {
            return NextResponse.json({ installationId: null });
        }
    } catch (error) {
        console.error('Error checking GitHub installation:', error);
        return NextResponse.json({ error: 'Failed to check GitHub installation' }, { status: 500 });
    }
}