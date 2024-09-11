'use client'

import DashboardLayout from "@/components/dashboard-layout"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useDeployment } from "@/hooks/use-deployment"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Copy, FileIcon } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from "sonner"

async function fetchProject(projectId: string) {
    const vercelResponse = await fetch(`/api/projects/${projectId}`)
    const dbResponse = await fetch(`/api/projects/${projectId}/db`)

    if (!vercelResponse.ok || !dbResponse.ok) {
        throw new Error('Failed to fetch project data')
    }

    const vercelData = await vercelResponse.json()
    const dbData = await dbResponse.json()

    return { ...vercelData, ...dbData }
}

async function submitQuery(projectId: string, query: string) {
    const response = await fetch(`/api/projects/${projectId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    })
    if (!response.ok) {
        throw new Error('Failed to submit query')
    }
    return response.json()
}

export default function ProjectPage() {
    const params = useParams()
    const router = useRouter()
    const queryClient = useQueryClient()
    const projectId = params?.id as string
    const [query, setQuery] = useState("")

    const { data: project, isLoading, error } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => fetchProject(projectId),
    })

    // Set the initial query state when the project data is loaded
    useEffect(() => {
        if (project?.query) {
            setQuery(project.query)
        }
    }, [project])

    const deployMutation = useDeployment()

    const queryMutation = useMutation({
        mutationFn: (query: string) => submitQuery(projectId, query),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', projectId] })
            toast.success("Query updated successfully")
        },
        onError: () => {
            toast.error("Failed to update query")
        }
    })

    const handleDeploy = async () => {
        try {
            await deployMutation.mutateAsync(projectId)
            toast.success("Deployment initiated successfully")
        } catch (error) {
            console.error("Failed to start deployment:", error)
            toast.error("An unexpected error occurred while initiating the deployment.")
        }
    }

    const handleQuerySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        queryMutation.mutate(query)
    }

    const handleCopyToClipboard = (data: any) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        toast.success("Copied to clipboard")
    }

    const content = () => {
        if (isLoading) return <div>Loading...</div>
        if (error) return <div>Error: {(error as Error).message}</div>

        const urlFriendlyName = project.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        const pages = [
            '/',
            ...(project.data?.results?.map((result: PlaceData) => {
                const pageName = result.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                return {
                    name: result.name,
                    path: `/${pageName}`
                };
            }) || [])
        ];

        const fileStructure = [
            {
                id: "/",
                isSelectable: true,
                name: "/",
                children: pages.map((page, index) => ({
                    id: page.path,
                    isSelectable: true,
                    name: page.name,
                    children: [
                        {
                            id: `${page.path}/data.json`,
                            isSelectable: true,
                            name: "data.json",
                        },
                    ],
                })),
            },
        ];

        return (
            <>
                <div className="flex items-center mb-6">
                    <Button variant="ghost" onClick={() => router.back()} className="mr-4">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <h1 className="text-2xl font-semibold text-gray-900">Project Details</h1>
                </div>
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{project.name}</CardTitle>
                        <CardDescription>Project Information</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p><strong>ID:</strong> {project.id}</p>
                            <p><strong>Framework:</strong> {project.framework}</p>
                            <p><strong>Repository:</strong> {project.link?.repo || 'Not connected'}</p>
                            <p><strong>Latest Deployment:</strong> {project.latestDeployments?.[0]?.url || 'No deployments yet'}</p>
                            <Button onClick={handleDeploy} disabled={deployMutation.isPending}>
                                Deploy
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Project Query</CardTitle>
                        <CardDescription>Update the query for this project</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleQuerySubmit} className="space-y-4">
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Enter your query here"
                            />
                            <Button type="submit" disabled={queryMutation.isPending}>
                                Save Changes
                            </Button>
                        </form>
                        {project.data && (
                            <div className="mt-4 space-y-2">
                                <h3 className="font-semibold">Query Results:</h3>
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="item-1">
                                        <AccordionTrigger>View JSON Results</AccordionTrigger>
                                        <AccordionContent>
                                            <div className="relative">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="absolute top-2 right-2 z-10"
                                                    onClick={() => handleCopyToClipboard(project.data)}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <SyntaxHighlighter
                                                    language="json"
                                                    style={vscDarkPlus}
                                                    customStyle={{
                                                        margin: 0,
                                                        padding: '1rem',
                                                        fontSize: '0.875rem',
                                                    }}
                                                >
                                                    {JSON.stringify(project.data, null, 2)}
                                                </SyntaxHighlighter>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                                <div className="mt-4 space-y-4">
                                    <h4 className="font-semibold">Pages to Generate:</h4>
                                    <ul className="space-y-3">
                                        {pages.map((page, index) => (
                                            <li key={index} className="leading-none text-sm flex items-center">
                                                <FileIcon className="inline-block w-3.5 h-3.5 mr-1" />
                                                {typeof page === 'string' ? (
                                                    <span>{page}</span>
                                                ) : (
                                                    <Button
                                                        variant="link"
                                                        className="p-0 h-auto"
                                                        onClick={() => router.push(`/projects/${projectId}${page.path}`)}
                                                    >
                                                        {page.path}
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </>
        )
    }

    return (
        <DashboardLayout>
            {content()}
        </DashboardLayout>
    )
}

interface PlaceData {
    name: string;
    formatted_address: string;
    // Add other relevant fields you want to display
}