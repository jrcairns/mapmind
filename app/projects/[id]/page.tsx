// @ts-nocheck
'use client'
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IntegrationStatus } from "@/components/integration-status"
import { Loader2 } from "lucide-react"
import { useMutation } from "@tanstack/react-query"

export default function OnboardingPage() {
    const [githubConnected, setGithubConnected] = useState(false);
    const [vercelConnected, setVercelConnected] = useState(false);
    const [newRepoName, setNewRepoName] = useState('');
    const [createdRepoUrl, setCreatedRepoUrl] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const [githubAppName, setGithubAppName] = useState<string | null>(null);

    useEffect(() => {
        checkConnections();
    }, []);

    const checkConnections = async () => {
        await checkGitHubConnection();
        await checkVercelConnection();
    };

    const checkGitHubConnection = async () => {
        // ... (keep existing implementation)
    };

    const checkVercelConnection = async () => {
        // ... (keep existing implementation)
    };

    const handleGitHubConnect = () => {
        // ... (keep existing implementation)
    };

    const handleVercelConnect = () => {
        // ... (keep existing implementation)
    };

    const createRepoAndInstallGitHubApp = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/github/create-repo-from-template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newRepoName }),
            });

            if (!response.ok) {
                throw new Error('Failed to create repository and set up project');
            }

            const data = await response.json();
            setCreatedRepoUrl(data.repoUrl);
            setProjectId(data.projectId);
            toast.success('Repository created and project set up successfully');
            toast.info(`Vercel project created: ${data.vercelProjectUrl}`);
            toast.info(`Deployment initiated: ${data.deploymentUrl}`);

            // Refresh the connections
            await checkConnections();
        } catch (error) {
            console.error('Error creating repository and setting up project:', error);
            toast.error('Failed to create repository and set up project');
        } finally {
            setIsLoading(false);
        }
    };

    const queryMutation = useMutation({
        mutationFn: async ({ query }: { query: string }) => {
            const response = await fetch(`/api/projects/${projectId}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            if (!response.ok) {
                throw new Error('Failed to submit query');
            }
            return response.json();
        },
        onSuccess: (data) => {
            setQuery(data.query);
            toast.success("Query updated successfully");
        },
        onError: () => {
            toast.error("Failed to update query");
        }
    });

    const handleQuerySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        queryMutation.mutate({ query });
    };

    const handleComplete = async () => {
        if (githubConnected && vercelConnected && createdRepoUrl && query) {
            try {
                const response = await fetch('/api/onboarding/complete', { method: 'POST' });
                if (response.ok) {
                    router.push('/dashboard');
                } else {
                    throw new Error('Failed to complete onboarding');
                }
            } catch (error) {
                console.error('Error completing onboarding:', error);
                toast.error("Failed to complete onboarding. Please try again.");
            }
        } else {
            toast.error("Please complete all onboarding steps before proceeding");
        }
    };

    const handleGitHubAuth = async () => {
        try {
            const response = await fetch('/api/github-auth', { method: 'POST' });
            if (!response.ok) {
                throw new Error('Failed to authenticate with GitHub');
            }
            const data = await response.json();
            console.log("Authenticated as GitHub app:", data.appName);
            setGithubAppName(data.appName);
            toast.success(`Authenticated as GitHub app: ${data.appName}`);
        } catch (error) {
            console.error("GitHub authentication error:", error);
            toast.error("Failed to authenticate with GitHub");
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-8">
            <h1 className="text-3xl font-bold mb-6">Onboarding</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Step 1: Connect Integrations</CardTitle>
                    <CardDescription>Connect your GitHub and Vercel accounts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <IntegrationStatus
                        name="GitHub"
                        connected={githubConnected}
                        onConnect={handleGitHubConnect}
                    />
                    <IntegrationStatus
                        name="Vercel"
                        connected={vercelConnected}
                        onConnect={handleVercelConnect}
                    />
                </CardContent>
            </Card>

            {githubConnected && vercelConnected && (
                <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Create Project</CardTitle>
                        <CardDescription>Create a new repository from our template</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            value={newRepoName}
                            onChange={(e) => setNewRepoName(e.target.value)}
                            placeholder="New repository name"
                        />
                        <Button onClick={createRepoAndInstallGitHubApp} disabled={!newRepoName || isLoading}>
                            {isLoading ? "Creating..." : "Create Project"}
                        </Button>
                        {createdRepoUrl && (
                            <p className="mt-2">
                                Repository created: <a href={createdRepoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{createdRepoUrl}</a>
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {createdRepoUrl && (
                <Card>
                    <CardHeader>
                        <CardTitle>Step 3: Set Project Query</CardTitle>
                        <CardDescription>Enter a query to define your project&apos;s focus</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleQuerySubmit} className="space-y-4">
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Enter your query here"
                            />
                            <Button type="submit" disabled={queryMutation.isPending}>
                                {queryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Query"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Button onClick={handleComplete} disabled={!githubConnected || !vercelConnected || !createdRepoUrl || !query || isLoading}>
                Complete Onboarding
            </Button>

            <Button onClick={handleGitHubAuth} className="mt-2">
                Authenticate GitHub App
            </Button>
            {githubAppName && (
                <p className="mt-2">Authenticated as GitHub app: {githubAppName}</p>
            )}
        </div>
    );
}