'use client'

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IntegrationStatus } from "@/components/integration-status"
import { Loader2 } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function OnboardingPage() {
    const [githubConnected, setGithubConnected] = useState(false);
    const [vercelConnected, setVercelConnected] = useState(false);
    const [initialCheckDone, setInitialCheckDone] = useState(false);
    const [newRepoName, setNewRepoName] = useState('');
    const [createdRepoUrl, setCreatedRepoUrl] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectData, setProjectData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const router = useRouter();

    const checkConnections = useCallback(async (showToasts = false) => {
        await checkGitHubConnection(showToasts);
        await checkVercelConnection(showToasts);
        setInitialCheckDone(true);
    }, []);

    useEffect(() => {
        checkConnections();
    }, [checkConnections]);

    const checkGitHubConnection = async (showToasts = false) => {
        try {
            const response = await fetch('/api/github/check-installation', { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                const isConnected = !!data.installationId;
                setGithubConnected(isConnected);
                if (showToasts) {
                    if (isConnected) {
                        toast.success(`GitHub App is installed and valid`);
                    } else {
                        toast.info("GitHub App is not installed or the installation is no longer valid");
                    }
                }
            }
        } catch (error) {
            console.error("GitHub connection check error:", error);
            if (showToasts) {
                toast.error("Failed to check GitHub installation");
            }
        }
    };

    const checkVercelConnection = async (showToasts = false) => {
        try {
            const response = await fetch('/api/vercel/check-connection', { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                setVercelConnected(data.connected);
                if (showToasts && data.connected) {
                    toast.success("Vercel account is connected");
                }
            }
        } catch (error) {
            console.error("Vercel connection check error:", error);
            if (showToasts) {
                toast.error("Failed to check Vercel connection");
            }
        }
    };

    const handleGitHubConnect = () => {
        window.location.href = `https://github.com/apps/mapmindapp/installations/new`;
    };

    const handleVercelConnect = () => {
        window.open("https://vercel.com/integrations/mapmind", "_blank");
    };

    const createRepoAndInstallGitHubApp = async () => {
        if (createdRepoUrl) {
            // If a repo has already been created, don't allow another submission
            return;
        }

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
            console.log("Create repo response:", data); // Debug log

            setCreatedRepoUrl(data.repoUrl);
            setProjectId(data.projectId);
            setProjectData(data); // Store the full project data
            toast.success('Repository created and project set up successfully');
            toast.info(`Vercel project created: ${data.vercelProjectUrl}`);

            // Refresh the connections without showing toasts
            await checkConnections(false);
        } catch (error) {
            console.error('Error creating repository and setting up project:', error);
            toast.error('Failed to create repository and set up project');
        } finally {
            setIsLoading(false);
        }
    };

    const onboardingProcess = useMutation({
        mutationFn: async ({ query }: { query: string }) => {
            if (!projectId || !projectData) throw new Error('Project data is not set');

            console.log("Project Data:", projectData); // Debug log

            // Step 1: Update project with query results
            const queryResponse = await fetch(`/api/projects/${projectId}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            if (!queryResponse.ok) throw new Error('Failed to update project with query');
            const queryData = await queryResponse.json();

            // Step 2: Generate content
            const contentResponse = await fetch(`/api/projects/${projectId}/generate-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, results: queryData.data.results }),
            });
            if (!contentResponse.ok) throw new Error('Failed to generate content');

            const reader = contentResponse.body?.getReader();
            const decoder = new TextDecoder();
            let generatedContent = '';

            while (true) {
                const { done, value } = await reader?.read() ?? { done: true, value: undefined };
                if (done) break;
                generatedContent += decoder.decode(value);
            }

            console.log("Content generated successfully:", generatedContent);

            // Step 3: Save generated content
            const saveContentResponse = await fetch(`/api/projects/${projectId}/save-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: generatedContent }),
            });
            if (!saveContentResponse.ok) throw new Error('Failed to save generated content');

            return { success: true, projectId };
        },
        onSuccess: (data) => {
            setOnboardingComplete(true);
            toast.success("Onboarding completed successfully!");
            // You can use the projectId here if needed
            console.log("Onboarding completed for project:", data.projectId);
        },
        onError: (error) => {
            console.error("Onboarding error:", error); // Debug log
            toast.error(`Onboarding failed: ${error.message}`);
        }
    });

    const handleQuerySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onboardingProcess.mutate({ query });
    };

    const handleComplete = async () => {
        if (onboardingComplete) {
            try {
                const response = await fetch('/api/onboarding/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId })
                });
                if (response.ok) {
                    router.push(`/projects/${projectId}`);
                } else {
                    throw new Error('Failed to complete onboarding');
                }
            } catch (error) {
                console.error('Error completing onboarding:', error);
                toast.error("Failed to complete onboarding. Please try again.");
            }
        } else {
            toast.error("Please complete all required onboarding steps before proceeding");
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
                        isConnected={githubConnected}
                        onConnect={handleGitHubConnect}
                    />
                    <IntegrationStatus
                        name="Vercel"
                        isConnected={vercelConnected}
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
                            disabled={!!createdRepoUrl}
                        />
                        <Button
                            onClick={createRepoAndInstallGitHubApp}
                            disabled={!newRepoName || isLoading || !!createdRepoUrl}
                        >
                            {isLoading ? "Creating..." : (createdRepoUrl ? "Project Created" : "Create Project")}
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
                        <CardTitle>Step 3: Set Project Query and Complete Onboarding</CardTitle>
                        <CardDescription>Enter a query to define your project&apos;s focus and finalize setup</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleQuerySubmit} className="space-y-4">
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Enter your query here"
                                disabled={onboardingProcess.isPending}
                            />
                            <Button type="submit" disabled={onboardingProcess.isPending}>
                                {onboardingProcess.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : "Complete Setup"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Button
                onClick={handleComplete}
                disabled={!onboardingComplete}
            >
                Go to Dashboard
            </Button>
        </div>
    );
}