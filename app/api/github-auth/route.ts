import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { Octokit } from '@octokit/rest';

export async function POST() {
    try {
        const { userId } = auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tokens = await clerkClient.users.getUserOauthAccessToken(userId, "oauth_github");
        const githubToken = tokens.data[0]

        if (!githubToken) {
            return NextResponse.json({ error: 'GitHub account not connected' }, { status: 400 });
        }

        const octokit = new Octokit({ auth: githubToken.token });

        const { data } = await octokit.rest.users.getAuthenticated();
        console.log("Authenticated as GitHub user:", data.login);

        return NextResponse.json({ success: true, githubUsername: data.login });
    } catch (error) {
        console.error("GitHub authentication error:", error);
        return NextResponse.json({ error: "Failed to authenticate with GitHub" }, { status: 500 });
    }
}