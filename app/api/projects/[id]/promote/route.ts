import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { placeId, updatedResults } = await request.json();
        const projectId = params.id;

        if (!projectId || !placeId || !Array.isArray(updatedResults)) {
            return NextResponse.json({ error: 'Missing project ID, place ID, or invalid results' }, { status: 400 });
        }

        console.log("firstfirstfirstfirstfirstfirstfirstfirstfirstfirstfirstfirstfirstfirstfirstfirstfirstfirst");

        // Fetch the current project data
        const getResponse = await fetch(`/api/projects/${projectId}/update`, { method: 'GET' });
        if (!getResponse.ok) {
            throw new Error('Failed to fetch project data');
        }
        const projectData = await getResponse.json();

        // Update only the results in the project data
        const updatedProjectData = {
            ...projectData,
            data: {
                ...projectData.data,
                results: updatedResults
            }
        };

        // Update the project data using the update route
        const updateResponse = await fetch(`/api/projects/${projectId}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedProjectData),
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update project data');
        }

        // Find the promoted place to return in the response
        const promotedPlace = updatedResults.find(result => result.isBoosted);

        return NextResponse.json({
            success: true,
            promotedPlace: promotedPlace || null,
            updatedResults
        });
    } catch (error) {
        console.error('Error promoting place:', error);
        return NextResponse.json({ error: 'Failed to promote place' }, { status: 500 });
    }
}