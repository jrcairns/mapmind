import { useMutation } from '@tanstack/react-query'

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
    return useMutation({
        mutationFn: createDeployment,
    })
}