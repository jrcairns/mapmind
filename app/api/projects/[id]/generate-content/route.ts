import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai'
import { z } from 'zod';

export const maxDuration = 60;

// Define the Zod schema for the page components
const PageComponentsSchema = z.object({
    logo: z.object({ url: z.string() }),
    navigation: z.object({ links: z.array(z.object({ label: z.string(), url: z.string() })) }),
    hero: z.object({
        title: z.string(),
        description: z.string(),
        image: z.object({ url: z.string() })
    }),
    cta: z.object({
        title: z.string(),
        description: z.string(),
        image: z.object({ url: z.string() })
    }),
    faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
    footer: z.object({
        description: z.string(),
        links: z.array(z.object({ label: z.string(), url: z.string() }))
    })
});

export async function POST(req: Request) {
    try {
        const { query, results } = await req.json();
        console.log("Received query:", query);

        const prompt = `
        Generate content for a directory listing website about ${query}. The content should be structured as follows:

        Use the following information from the search results to inform the content:
        ${results.map((result: any) => `- ${result.name}: ${result.description}`).join('\n')}

        Ensure that the content is relevant to ${query} and the provided search results.
        Do not include any explanations or additional text outside of the JSON structure.
        `;

        const result = await streamObject({
            model: openai("gpt-4"),
            schema: PageComponentsSchema,
            prompt: prompt,
            maxTokens: 2000,
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error("Error in API route:", error);
        return new Response(JSON.stringify({ error: "An error occurred while generating the content" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
