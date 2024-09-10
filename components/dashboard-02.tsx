"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { useProjects } from "@/hooks/use-projects"
import { useVercelIntegration } from "@/hooks/use-vercel-integration"
import { useDeployment } from "@/hooks/use-deployment"
import { useQueryClient } from '@tanstack/react-query'
import { toast } from "sonner"

export default function Dashboard() {
  const queryClient = useQueryClient()
  const { data: integrationStatus, isLoading: isCheckingIntegration, error: integrationError } = useVercelIntegration()
  const { data: projects, isLoading: isLoadingProjects, error: projectsError } = useProjects()
  const deployMutation = useDeployment()

  const handleDeploy = async (projectId: string) => {
    try {
      await deployMutation.mutateAsync(projectId)
      toast.success("Deployment Initiated")
      // Start polling for deployment status
      queryClient.invalidateQueries({ queryKey: ['latestDeploymentEvent'] })
    } catch (error) {
      toast.error("Failed to start deployment.")
    }
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
          <Link
            href="https://vercel.com/integrations/mapmind"
            target="_blank"
            className={buttonVariants({ variant: "default" })}
          >
            Integrate Vercel
          </Link>
        </div>
      )
    }

    if (isLoadingProjects) {
      return <p>Loading projects...</p>
    }

    if (projectsError) {
      return <p>Error loading projects: {projectsError.message}</p>
    }

    return (
      <ul className="space-y-4">
        {projects?.projects.map((project: Project) => (
          <li key={project.id} className="flex items-center justify-between">
            <span>{project.name}</span>
            <Button
              onClick={() => handleDeploy(project.id)}
              disabled={deployMutation.isPending}
            >
              Deploy
            </Button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <UserButton afterSignOutUrl="/" />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

interface Project {
  id: string;
  name: string;
  // Add other properties as needed
}
