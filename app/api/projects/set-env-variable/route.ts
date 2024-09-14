import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { projectId, key, value, target } = await req.json();

    try {
        const result = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key,
                value,
                type: 'plain',
                target,
                gitBranch: 'main', // or whichever branch you want to target
            }),
        });

        if (!result.ok) {
            throw new Error(`Failed to set environment variable: ${result.statusText}`);
        }

        const data = await result.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error setting environment variable:', error);
        return NextResponse.json({ error: 'Failed to set environment variable' }, { status: 500 });
    }
}