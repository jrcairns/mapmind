import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/app/lib/crypto';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD!;

export async function POST(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
        });

        if (!dbUser || !dbUser.vercelAccessToken) {
            return NextResponse.json({ error: 'Vercel account not connected' }, { status: 400 });
        }

        const decryptedToken = await decrypt(dbUser.vercelAccessToken, MASTER_PASSWORD);

        const { projectId } = await request.json();

        // Fetch project details
        const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=${dbUser.vercelTeamId || ''}`, {
            headers: {
                "Authorization": `Bearer ${decryptedToken}`,
            },
            method: "GET"
        });

        if (!projectResponse.ok) {
            throw new Error('Failed to fetch project details from Vercel');
        }

        const projectData = await projectResponse.json();

        console.log('Project Data:', JSON.stringify(projectData, null, 2));

        // Check if the project has a valid Git repository
        if (!projectData.link || !projectData.link.type || !projectData.link.repo) {
            return NextResponse.json({ error: 'Project is not connected to a Git repository' }, { status: 400 });
        }

        // Prepare deployment payload
        const deploymentPayload: DeploymentPayload = {
            name: projectData.name,
            target: 'production', // or 'preview' if you prefer
            gitSource: {
                type: projectData.link.type,
                repo: projectData.link.repo,
                ref: projectData.link.ref || projectData.link.branch || 'master',
            },
        };

        if (projectData.link.type === 'github') {
            deploymentPayload.gitSource.repoId = projectData.link.repoId;
        }

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

        console.log('Deployment Data:', JSON.stringify(deploymentData, null, 2));

        return NextResponse.json(deploymentData);
    } catch (error) {
        console.error('Error creating deployment:', error);
        return NextResponse.json({ error: 'Failed to create deployment' }, { status: 500 });
    }
}

// Define the DeploymentPayload type
interface DeploymentPayload {
    name: string;
    target: string;
    gitSource: {
        type: string;
        repo: string;
        ref: string;
        repoId?: string;
    };
}