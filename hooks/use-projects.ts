import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { useVercelIntegration } from './use-vercel-integration'

async function fetchProjects() {
    const response = await fetch('/api/projects')
    if (!response.ok) {
        throw new Error('Failed to fetch projects')
    }
    return response.json()
}

export function useProjects() {
    const { user } = useUser()
    const { data: integrationStatus } = useVercelIntegration()

    return useQuery({
        queryKey: ['projects', user?.id],
        queryFn: fetchProjects,
        enabled: !!user?.id && integrationStatus?.isIntegrated,
    })
}