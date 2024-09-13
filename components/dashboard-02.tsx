"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDeployment } from "@/hooks/use-deployment"
import { useVercelIntegration } from "@/hooks/use-vercel-integration"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useInView } from "react-intersection-observer"
import { toast } from "sonner"
import { Loader2, ArrowRight } from "lucide-react"

async function fetchProjects({ pageParam = undefined }) {
  const response = await fetch(`/api/projects${pageParam ? `?until=${pageParam}` : ''}`)
  if (!response.ok) {
    throw new Error('Failed to fetch projects')
  }
  return response.json()
}

async function saveSelectedProjects(selectedProjects: string[]) {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ selectedProjects }),
  })
  if (!response.ok) {
    throw new Error('Failed to save selected projects')
  }
  return response.json()
}

export default function Dashboard() {
  const { data: integrationStatus, isLoading: isCheckingIntegration, error: integrationError } = useVercelIntegration()
  const queryClient = useQueryClient()
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingProjects,
    error: projectsError
  } = useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.pagination?.next || undefined,
    enabled: integrationStatus?.isIntegrated,
  })

  const saveProjectsMutation = useMutation({
    mutationFn: saveSelectedProjects,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success("Projects updated successfully")
    },
    onError: () => {
      toast.error("Failed to update projects")
    }
  })

  const deployMutation = useDeployment()
  const [selectedProjects, setSelectedProjects] = useState<Project[]>([])
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const { ref, inView } = useInView()

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, fetchNextPage, hasNextPage])

  useEffect(() => {
    if (data?.pages) {
      const allProjects = data.pages.flatMap(page => page.projects)
      const selected = allProjects.filter((project: Project) => project.selected)
      const available = allProjects.filter((project: Project) => !project.selected)
      setSelectedProjects(selected)
      setAvailableProjects(available)
    }
  }, [data])

  const handleDeploy = async (projectId: string) => {
    try {
      await deployMutation.mutateAsync(projectId)
      toast.success("Deployment initiated successfully")
    } catch (error) {
      console.error("Failed to start deployment:", error)
      toast.error("An unexpected error occurred while initiating the deployment.")
    }
  }

  const handleAddProject = async (projectId: string) => {
    const project = availableProjects.find(p => p.id === projectId)
    if (project) {
      const newSelectedProjects = [...selectedProjects, project]
      setSelectedProjects(newSelectedProjects)
      setAvailableProjects(prev => prev.filter(p => p.id !== projectId))
      await saveProjectsMutation.mutateAsync(newSelectedProjects.map(p => p.id))
    }
  }

  const handleRemoveProject = async (project: Project) => {
    const newSelectedProjects = selectedProjects.filter(p => p.id !== project.id)
    setSelectedProjects(newSelectedProjects)
    setAvailableProjects(prev => [...prev, project])
    await saveProjectsMutation.mutateAsync(newSelectedProjects.map(p => p.id))
  }

  const renderContent = () => {
    if (isCheckingIntegration) {
      return <Card className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></Card>
    }

    if (integrationError) {
      return (
        <Card className="p-6">
          <p className="text-red-500">Error checking integration status: {integrationError.message}</p>
        </Card>
      )
    }

    if (!integrationStatus?.isIntegrated) {
      return (
        <Card className="text-center p-6">
          <CardHeader>
            <CardTitle>Vercel Integration Required</CardTitle>
            <CardDescription>Connect your Vercel account to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="https://vercel.com/integrations/mapmind" target="_blank">
                Integrate Vercel <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (isLoadingProjects) {
      return <Card className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></Card>
    }

    if (projectsError) {
      return (
        <Card className="p-6">
          <p className="text-red-500">Error loading projects: {(projectsError as Error).message}</p>
        </Card>
      )
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Selected Projects</CardTitle>
            <CardDescription>Manage your selected Vercel projects</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProjects.length === 0 ? (
              <p className="text-gray-500">No projects selected. Add projects from the list below.</p>
            ) : (
              <ul className="space-y-4">
                {selectedProjects.map((project) => (
                  <li key={project.id} className="flex items-center justify-between bg-secondary p-3 rounded-md">
                    <Link href={`/projects/${project.id}`} className="hover:underline">
                      <span>{project.name}</span>
                    </Link>
                    <div className="space-x-2">
                      <Button onClick={() => handleDeploy(project.id)} disabled={deployMutation.isPending} size="sm">
                        {deployMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deploy"}
                      </Button>
                      <Button onClick={() => handleRemoveProject(project)} variant="destructive" size="sm">
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Projects</CardTitle>
            <CardDescription>Add more projects to your selection</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleAddProject}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project to add" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {availableProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
                {hasNextPage && (
                  <SelectItem value="load-more" ref={ref}>
                    {isFetchingNextPage ? 'Loading more...' : 'Load more'}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        {renderContent()}
      </div>
    </DashboardLayout>
  )
}

interface Project {
  id: string;
  name: string;
  selected?: boolean;
}