'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import DashboardLayout from "@/components/dashboard-layout"
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"

export default function DashboardPage() {
    const [githubInstallationId, setGithubInstallationId] = useState<number | null>(null);
    const [repos, setRepos] = useState<Array<{ name: string, url: string }>>([]);
    const [newRepoName, setNewRepoName] = useState('');
    const [createdRepoUrl, setCreatedRepoUrl] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        checkConnections();
    }, []);

    useEffect(() => {
        if (githubInstallationId) {
            fetchRepos();
        } else {
            setRepos([]);
        }
    }, [githubInstallationId]);

    const handleGitHubAppInstall = () => {
        window.location.href = `https://github.com/apps/mapmindapp/installations/new`;
    };

    const checkGitHubInstallation = async () => {
        try {
            const response = await fetch('/api/github/check-installation', { method: 'GET' });
            if (!response.ok) {
                throw new Error('Failed to check GitHub installation');
            }
            const data = await response.json();
            if (data.installationId) {
                setGithubInstallationId(data.installationId);
                toast.success(`GitHub App is installed and valid`);
            } else {
                setGithubInstallationId(null);
                toast.info("GitHub App is not installed or the installation is no longer valid");
            }
        } catch (error) {
            console.error("GitHub installation check error:", error);
            toast.error("Failed to check GitHub installation");
        }
    };

    const fetchRepos = async () => {
        try {
            const response = await fetch('/api/github/repos', { method: 'GET' });
            if (!response.ok) {
                throw new Error('Failed to fetch repositories');
            }
            const data = await response.json();
            setRepos(data.repos);
        } catch (error) {
            console.error("Error fetching repositories:", error);
            toast.error("Failed to fetch repositories");
        }
    };

    const createRepoAndInstallGitHubApp = async () => {
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
            toast.success('Repository created and project set up successfully');
            toast.info(`Vercel project created: ${data.vercelProjectUrl}`);
            toast.info(`Deployment initiated: ${data.deploymentUrl}`);

            // Refresh the installation check and repo list
            await checkGitHubInstallation();
            await fetchRepos();
        } catch (error) {
            console.error('Error creating repository and setting up project:', error);
            toast.error('Failed to create repository and set up project');
        }
    };

    const checkConnections = async () => {
        const githubConnected = await checkGitHubConnection();
        const vercelConnected = await checkVercelConnection();

        if (!githubConnected || !vercelConnected) {
            toast.error("Some integrations are missing. Redirecting to onboarding.");
            router.push('/onboarding');
        }
    };

    const checkGitHubConnection = async () => {
        try {
            const response = await fetch('/api/github/check-installation', { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                return !!data.installationId;
            }
        } catch (error) {
            console.error("GitHub connection check error:", error);
        }
        return false;
    };

    const checkVercelConnection = async () => {
        try {
            const response = await fetch('/api/vercel/check-connection', { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                return data.connected;
            }
        } catch (error) {
            console.error("Vercel connection check error:", error);
        }
        return false;
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <h1 className="text-2xl font-semibold">Dashboard</h1>

                <div>
                    {!githubInstallationId ? (
                        <Button onClick={handleGitHubAppInstall}>
                            Install GitHub App
                        </Button>
                    ) : (
                        <>
                            <p>GitHub App is installed and valid</p>
                            <Button onClick={checkGitHubInstallation} className="ml-4">
                                Recheck Installation
                            </Button>
                        </>
                    )}
                </div>

                {githubInstallationId && (
                    <div>
                        <h2 className="text-xl font-semibold mt-4 mb-2">Your Repositories</h2>
                        {repos.length > 0 ? (
                            <ul className="list-disc pl-5">
                                {repos.map((repo) => (
                                    <li key={repo.name}>
                                        <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                            {repo.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No repositories found.</p>
                        )}
                    </div>
                )}

                {githubInstallationId && (
                    <div className="mt-6">
                        <h2 className="text-xl font-semibold mb-2">Create New Repository and Install GitHub App</h2>
                        <div className="flex space-x-2">
                            <Input
                                value={newRepoName}
                                onChange={(e) => setNewRepoName(e.target.value)}
                                placeholder="New repository name"
                            />
                            <Button onClick={createRepoAndInstallGitHubApp} disabled={!newRepoName}>
                                Create Repo and Install GitHub App
                            </Button>
                        </div>
                        {createdRepoUrl && (
                            <p className="mt-2">
                                Repository created: <a href={createdRepoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{createdRepoUrl}</a>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}