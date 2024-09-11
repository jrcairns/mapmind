"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDeployment } from "@/hooks/use-deployment"
import { useVercelIntegration } from "@/hooks/use-vercel-integration"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import { toast } from "sonner"

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
      return <p>Checking integration status...</p>
    }

    if (integrationError) {
      return <p>Error checking integration status: {integrationError.message}</p>
    }

    if (!integrationStatus?.isIntegrated) {
      return (
        <div className="text-center">
          <p className="mb-4">You haven&apos;t integrated your Vercel account yet.</p>
          <Button asChild>
            <Link href="https://vercel.com/integrations/mapmind" target="_blank">
              Integrate Vercel
            </Link>
          </Button>
        </div>
      )
    }

    if (isLoadingProjects) {
      return <p>Loading projects...</p>
    }

    if (projectsError) {
      return <p>Error loading projects: {(projectsError as Error).message}</p>
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
              <p>No projects selected. Add projects from the list below.</p>
            ) : (
              <ul className="space-y-4">
                {selectedProjects.map((project) => (
                  <li key={project.id} className="flex items-center justify-between bg-secondary p-3 rounded-md">
                    <Link href={`/projects/${project.id}`} className="hover:underline">
                      <span>{project.name}</span>
                    </Link>
                    <div className="space-x-2">
                      <Button onClick={() => handleDeploy(project.id)} disabled={deployMutation.isPending} size="sm">
                        Deploy
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
              <SelectContent>
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
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>
      {renderContent()}
    </DashboardLayout>
  )
}

interface Project {
  id: string;
  name: string;
  selected?: boolean;
}