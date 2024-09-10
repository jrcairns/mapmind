import { useMutation, useQueryClient } from '@tanstack/react-query'

async function createDeployment(projectId: string) {
    const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
    })
    if (!response.ok) {
        throw new Error('Failed to create deployment')
    }
    return response.json()
}

export function useDeployment() {
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: createDeployment,
        onSuccess: () => {
            // Start polling for deployment status
            queryClient.invalidateQueries({ queryKey: ['latestDeploymentEvent'] })
        },
    })

    return mutation
}