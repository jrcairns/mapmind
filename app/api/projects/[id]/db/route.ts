import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await currentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const project = await db.project.findUnique({
            where: { vercelId: params.id },
            select: { query: true, data: true }
        })

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        return NextResponse.json(project)
    } catch (error) {
        console.error('Error fetching project data:', error)
        return NextResponse.json({ error: 'Failed to fetch project data' }, { status: 500 })
    }
}