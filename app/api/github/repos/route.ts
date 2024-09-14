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

        if (!user?.githubInstallationId) {
            return NextResponse.json({ error: 'GitHub App not installed' }, { status: 400 });
        }

        const octokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
                appId: process.env.GITHUB_APP_ID!,
                privateKey: process.env.GITHUB_PRIVATE_KEY!,
                installationId: user.githubInstallationId,
            },
        });

        // Get the authenticated app installation
        const { data: installation } = await octokit.apps.getInstallation({ installation_id: user.githubInstallationId });

        // List repositories for the installation
        const { data: repos } = await octokit.apps.listReposAccessibleToInstallation();

        return NextResponse.json({
            repos: repos.repositories.map(repo => ({
                name: repo.name,
                url: repo.html_url
            }))
        });
    } catch (error) {
        console.error('Error fetching GitHub repositories:', error);
        return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
    }
}