import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'

interface ResultItem {
    isBoosted: boolean;
    place_id: string;
    name: string;
    // Add other properties as needed
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query

    try {
        const project = await db.project.findFirst({
            where: { id: { equals: id as string } }
        })

        if (!project) {
            return res.status(404).json({ error: 'Project not found' })
        }

        console.log({ project })

        let results: ResultItem[] = [];
        if (project.data && typeof project.data === 'object' && 'results' in project.data && Array.isArray(project.data.results)) {
            results = (project.data.results as any[]).map(item => item as ResultItem);
        }

        // Sort results to prioritize boosted ones
        const sortedResults = results.sort((a, b) => {
            if (a.isBoosted && !b.isBoosted) return -1
            if (!a.isBoosted && b.isBoosted) return 1
            return 0
        })

        res.status(200).json({
            query: project.query,
            page: project.page,
            results: sortedResults
        })
    } catch (error) {
        console.error('Error fetching project data:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}