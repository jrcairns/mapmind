// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { Client } from "@googlemaps/google-maps-services-js"

const client = new Client({});

interface PlaceData {
    place_id: string;
    name: string;
    formatted_address: string;
}

interface Review {
    author_name: string;
    rating: number;
    relative_time_description: string;
    text: string;
}

interface DetailedPlaceData {
    place_id: string;
    name: string;
    formatted_address: string;
    formatted_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    url?: string;
    wheelchair_accessible_entrance?: boolean;
    opening_hours?: {
        weekday_text: string[];
    };
    types?: string[];
    reviews?: Review[];
    photo?: {
        photo_reference: string;
        width: number;
        height: number;
        url: string;
    };
}

async function getQueryData(query: string): Promise<{ results: PlaceData[], error?: string }> {
    try {
        const response = await client.textSearch({
            params: {
                query: query,
                key: process.env.GOOGLE_MAPS_API_KEY!,
            },
        });

        if (response.status !== 200) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        return {
            // @ts-ignore
            results: response.data.results.map(place => ({
                place_id: place.place_id,
                name: place.name,
                formatted_address: place.formatted_address,
            }))
        };
    } catch (error) {
        console.error("Error fetching data:", error);
        return {
            results: [],
            error: error instanceof Error ? error.message : 'An unknown error occurred',
        };
    }
}

async function getPlaceDetails(placeId: string): Promise<DetailedPlaceData | null> {
    try {
        const response = await client.placeDetails({
            params: {
                place_id: placeId,
                key: process.env.GOOGLE_MAPS_API_KEY!,
            },
        });

        if (response.status !== 200) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const result = response.data.result;

        let photoData;

        if (result.photos && result.photos.length > 0) {
            const photoReference = result.photos[0].photo_reference;

            const params = {
                photoreference: photoReference,
                maxwidth: 1600,
                maxheight: 1600,
                key: process.env.GOOGLE_MAPS_API_KEY!,
            }
            const photoResponse = await client.placePhoto({
                params,
                responseType: 'arraybuffer'
            });

            if (photoResponse.status === 200) {
                photoData = {
                    photo_reference: photoReference,
                    width: params.maxwidth,
                    height: params.maxheight,
                    url: "https://" + photoResponse.request.socket._host + photoResponse.request.path
                };
            }
        }
        return {
            place_id: placeId,
            name: result.name,
            formatted_address: result.formatted_address,
            formatted_phone_number: result.formatted_phone_number,
            website: result.website,
            rating: result.rating,
            user_ratings_total: result.user_ratings_total,
            wheelchair_accessible_entrance: result.wheelchair_accessible_entrance,
            url: result.url,
            opening_hours: result.opening_hours ? {
                weekday_text: result.opening_hours.weekday_text
            } : undefined,
            types: result.types,
            reviews: result.reviews && result.reviews.length > 0 ? [{
                author_name: result.reviews[0].author_name,
                rating: result.reviews[0].rating,
                relative_time_description: result.reviews[0].relative_time_description,
                text: result.reviews[0].text
            }] : undefined,
            photo: photoData,
        };
    } catch (error) {
        console.error(`Error fetching details for place ${placeId}:`, error);
        return null;
    }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const clerkUser = await currentUser()

        if (!clerkUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await db.user.findUnique({
            where: { clerkId: clerkUser.id }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }
        const { query, promotedPlace } = await request.json()

        const project = await db.project.findFirst({
            where: {
                id: params.id,
                userId: dbUser.id
            }
        })

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }
        // Get initial data from Google Maps API
        const initialQueryData = await getQueryData(query);

        // Fetch detailed data for each place
        let detailedResults = await Promise.all(
            initialQueryData.results.slice(0, 20).map(async (place) => {
                const details = await getPlaceDetails(place.place_id);
                return details || place;
            })
        );

        // Handle promoted place
        if (promotedPlace) {
            const promotedDetails = await getPlaceDetails(promotedPlace.place_id);
            if (promotedDetails) {
                // Find the index of the currently promoted place
                const currentPromotedIndex = detailedResults.findIndex(place => place.isBoosted);

                // If there's a currently promoted place, replace it
                if (currentPromotedIndex !== -1) {
                    detailedResults[currentPromotedIndex] = {
                        ...detailedResults[currentPromotedIndex],
                        isBoosted: false
                    };
                }

                // Add the new promoted place at the top
                detailedResults = [
                    { ...promotedDetails, isBoosted: true },
                    ...detailedResults.filter(place => place.place_id !== promotedDetails.place_id)
                ];
            }
        }

        // Ensure we have only 20 results
        const finalResults = detailedResults.slice(0, 20);

        // Save the updated results and query
        await db.project.update({
            where: { id: project.id },
            data: {
                data: { results: finalResults },
                query: query
            }
        })

        return NextResponse.json({ success: true, query, data: { results: finalResults } })
    } catch (error) {
        console.error('Error processing query:', error)
        return NextResponse.json({ error: 'Failed to process query' }, { status: 500 })
    }
}