import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'

async function checkVercelIntegration() {
    const response = await fetch('/api/vercel-integration-status')
    if (!response.ok) {
        throw new Error('Failed to check Vercel integration status')
    }
    return response.json()
}

export function useVercelIntegration() {
    const { user } = useUser()
    return useQuery({
        queryKey: ['vercelIntegration', user?.id],
        queryFn: checkVercelIntegration,
        enabled: !!user?.id,
    })
}