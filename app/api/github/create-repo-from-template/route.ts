import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { decrypt } from '@/app/lib/crypto';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD!;

export async function POST(request: Request) {
    const { userId } = auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            select: {
                id: true,
                githubInstallationId: true,
                vercelAccessToken: true,
                vercelTeamId: true
            },
        });

        if (!user?.githubInstallationId || !user?.vercelAccessToken) {
            return NextResponse.json({ error: 'GitHub App or Vercel not connected' }, { status: 400 });
        }

        const { name } = await request.json();

        // GitHub: Create repository from template
        const octokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
                appId: process.env.GITHUB_APP_ID!,
                privateKey: process.env.GITHUB_PRIVATE_KEY!,
                installationId: user.githubInstallationId,
            },
        });

        const { data: installation } = await octokit.apps.getInstallation({ installation_id: user.githubInstallationId });
        const { data: repo } = await octokit.repos.createUsingTemplate({
            template_owner: 'jrcairns',
            template_repo: 'blawdir-template',
            name: name,
            // @ts-ignore
            owner: installation.account.login,
            private: true,
        });

        // Ensure the repository has content
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds to ensure GitHub processes the template

        // Get the default branch
        const { data: repoInfo } = await octokit.repos.get({
            // @ts-ignore
            owner: installation.account.login,
            repo: name,
        });

        const defaultBranch = repoInfo.default_branch || "master";

        // Vercel: Create project
        const decryptedToken = await decrypt(user.vercelAccessToken, MASTER_PASSWORD);
        const vercelResponse = await fetch(`https://api.vercel.com/v9/projects`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${decryptedToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                environmentVariables: [
                    {
                        key: "NEXT_PUBLIC_API_URL",
                        value: "https://mapmind-seven.vercel.app",
                        target: ["production"],
                        type: "plain",
                    },
                ],
                framework: "nextjs",
                gitRepository: {
                    type: 'github',
                    // @ts-ignore
                    repo: `${installation.account.login}/${name}`,
                    productionBranch: defaultBranch,
                },
            }),
        });

        if (!vercelResponse.ok) {
            const errorData = await vercelResponse.json();
            console.error('Failed to create Vercel project:', errorData);
            throw new Error('Failed to create Vercel project');
        }

        const vercelProject = await vercelResponse.json();

        // Create a new project in our database
        const dbProject = await db.project.create({
            data: {
                vercelId: vercelProject.id,
                name: name,
                userId: user.id,
            },
        });

        // Add environment variables to the Vercel project
        await addEnvironmentVariable(decryptedToken, vercelProject.id, user.vercelTeamId, 'NEXT_PUBLIC_PROJECT_ID', dbProject.id);
        // await addEnvironmentVariable(decryptedToken, vercelProject.id, user.vercelTeamId, 'NEXT_PUBLIC_API_URL', "https://mapmind-seven.vercel.app");

        // Prepare deployment payload with project settings
        const deploymentPayload = {
            name: vercelProject.name,
            target: 'production',
            gitSource: {
                type: 'github',
                // @ts-ignore
                repo: `${installation.account.login}/${name}`,
                ref: defaultBranch,
                repoId: repo.id.toString(), // Add this line
            },
            projectSettings: {
                framework: 'nextjs',
            },
        };

        console.log('Deployment Payload:', JSON.stringify(deploymentPayload, null, 2));

        // Create deployment
        const deploymentResponse = await fetch("https://api.vercel.com/v13/deployments", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${decryptedToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(deploymentPayload),
        });

        const deploymentData = await deploymentResponse.json();

        if (!deploymentResponse.ok) {
            console.error('Deployment Error:', JSON.stringify(deploymentData, null, 2));
            return NextResponse.json({ error: 'Failed to create deployment', details: deploymentData }, { status: deploymentResponse.status });
        }

        return NextResponse.json({
            success: true,
            repoUrl: repo.html_url,
            vercelProjectUrl: `https://vercel.com/${vercelProject.accountId}/${vercelProject.name}`,
            projectId: dbProject.id,
            vercelProjectId: vercelProject.id,
            deploymentUrl: deploymentData.url,
        });
    } catch (error) {
        console.error('Error creating repository, Vercel project, and triggering deployment:', error);
        return NextResponse.json({ error: 'Failed to complete the setup process' }, { status: 500 });
    }
}

async function addEnvironmentVariable(token: string, projectId: string, teamId: string | null, key: string, value: string) {
    const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?upsert=true`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            key,
            value,
            type: 'plain',
            target: ['production', 'preview', 'development'],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add environment variable for project ${projectId}: ${errorText}`);
    }

    return response.status;
}