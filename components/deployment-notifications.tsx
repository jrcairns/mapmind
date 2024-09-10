'use client'

import { useEffect } from 'react'
import { toast, Toaster } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'

async function fetchLatestDeploymentEvent() {
    const response = await fetch('/api/latest-deployment-event')
    if (!response.ok) {
        throw new Error('Failed to fetch latest deployment event')
    }
    return response.json()
}

export function DeploymentNotifications() {
    const queryClient = useQueryClient()

    const { data: latestEvent, error } = useQuery({
        queryKey: ['latestDeploymentEvent'],
        queryFn: fetchLatestDeploymentEvent,
        refetchInterval: (data) => {
            // Stop polling if deployment is complete or failed
            // @ts-ignore
            if (data?.status === 'succeeded' || data?.status === 'failed') {
                return false
            }
            return 5000 // Poll every 5 seconds
        },
        enabled: false, // Don't run the query on mount
    })

    useEffect(() => {
        if (error) {
            console.error('Error fetching deployment event:', error)
            toast.error('Failed to fetch deployment status')
        } else if (latestEvent) {
            toast.success(`Deployment ${latestEvent.status}`, {
                description: `Deployment ID: ${latestEvent.deploymentId}`,
            })

            // If deployment is complete or failed, stop polling
            if (latestEvent.status === 'succeeded' || latestEvent.status === 'failed') {
                queryClient.cancelQueries({ queryKey: ['latestDeploymentEvent'] })
            }
        }
    }, [latestEvent, error, queryClient])

    return <Toaster />
}