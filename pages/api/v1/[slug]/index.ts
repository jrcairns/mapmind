import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log("API route hit", { slug: req.query.slug, url: req.url });

    // Log all headers
    console.log("Request headers:", req.headers);

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { slug } = req.query;

    if (!slug || Array.isArray(slug)) {
        return res.status(400).json({ error: 'Invalid slug' });
    }

    try {
        const project = await db.project.findFirst({
            where: {
                name: slug
            },
            select: {
                id: true,
                name: true,
                query: true,
                data: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Ensure data is properly parsed if it's stored as a string
        let parsedData = project.data;
        if (typeof project.data === 'string') {
            try {
                parsedData = JSON.parse(project.data);
            } catch (error) {
                console.error('Error parsing project data:', error);
                parsedData = null;
            }
        }

        const sanitizedProject = {
            ...project,
            data: parsedData,
        };

        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).json(sanitizedProject);
    } catch (error) {
        console.error('Error fetching project details:', error);
        return res.status(500).json({ error: 'Failed to fetch project details' });
    }
}