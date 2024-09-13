import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await db.user.findUnique({
            where: { clerkId: clerkUser.id }
        });

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const pageData = await request.json();

        const project = await db.project.findFirst({
            where: {
                vercelId: params.id,
                userId: dbUser.id
            }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Update the project with the new page data
        const updatedProject = await db.project.update({
            where: { id: project.id },
            data: { page: pageData }
        });

        return NextResponse.json({ success: true, page: updatedProject.page });
    } catch (error) {
        console.error('Error updating page data:', error);
        return NextResponse.json({ error: 'Failed to update page data' }, { status: 500 });
    }
}