import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { decrypt } from '@/app/lib/crypto';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD!;

export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url)
        const until = searchParams.get('until')

        const vercelProjects = await fetchVercelProjects(decryptedToken, until);

        const dbProjects = await db.project.findMany({
            where: { userId: dbUser.id },
            select: { vercelId: true }
        });

        const selectedVercelIds = new Set(dbProjects.map(p => p.vercelId));

        const projectsWithSelection = vercelProjects.projects.map((project: any) => ({
            ...project,
            selected: selectedVercelIds.has(project.id)
        }));

        return NextResponse.json({ ...vercelProjects, projects: projectsWithSelection });
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await db.user.findUnique({
            where: { clerkId: user.id },
        });

        if (!dbUser || !dbUser.vercelAccessToken) {
            return NextResponse.json({ error: 'User not found or Vercel account not connected' }, { status: 404 });
        }

        const decryptedToken = await decrypt(dbUser.vercelAccessToken, MASTER_PASSWORD);

        const { selectedProjects } = await request.json();

        // Remove projects that are no longer selected
        await db.project.deleteMany({
            where: {
                userId: dbUser.id,
                vercelId: { notIn: selectedProjects }
            }
        });

        // Add or update selected projects
        for (const projectId of selectedProjects) {
            const projectDetails = await fetchProjectDetails(decryptedToken, projectId, dbUser.vercelTeamId);
            await db.project.upsert({
                where: { vercelId: projectId },
                update: { name: projectDetails.name },
                create: {
                    vercelId: projectId,
                    name: projectDetails.name,
                    userId: dbUser.id
                }
            });
        }

        return NextResponse.json({ message: 'Selected projects updated successfully' });
    } catch (error) {
        console.error('Error updating selected projects:', error);
        return NextResponse.json({ error: 'Failed to update selected projects' }, { status: 500 });
    }
}

// Helper function to fetch projects from Vercel
async function fetchVercelProjects(token: string, until?: string | null) {
    const vercelResponse = await fetch(`https://api.vercel.com/v9/projects${until ? `?until=${until}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!vercelResponse.ok) {
        throw new Error('Failed to fetch projects from Vercel');
    }

    return vercelResponse.json();
}

// Helper function to fetch project details from Vercel
async function fetchProjectDetails(token: string, projectId: string, teamId?: string | null) {
    const url = `https://api.vercel.com/v9/projects/${projectId}${teamId ? `?teamId=${teamId}` : ''}`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch project details from Vercel for project ${projectId}`);
    }

    const projectData = await response.json();
    return { name: projectData.name };
}