import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
    try {
        const user = await currentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await db.user.findUnique({
            where: { clerkId: user.id },
            select: { vercelAccessToken: true }
        })

        return NextResponse.json({
            isIntegrated: !!dbUser?.vercelAccessToken
        })
    } catch (error) {
        console.error('Error checking Vercel integration status:', error)
        return NextResponse.json({ error: 'Failed to check integration status' }, { status: 500 })
    }
}