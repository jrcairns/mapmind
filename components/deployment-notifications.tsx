'use client'

import { useEffect } from 'react'
import { toast, Toaster } from 'sonner'

export function DeploymentNotifications() {
    useEffect(() => {
        const sse = new EventSource('/api/webhooks/vercel');

        sse.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'ping') return; // Ignore ping events

            toast.success(`Deployment ${data.type}`, {
                description: `Deployment ID: ${data.payload.deployment.id}`,
            });

            // If deployment is complete or failed, close the connection
            if (data.type === 'deployment.succeeded' || data.type === 'deployment.error') {
                sse.close();
            }
        };

        sse.onerror = (error) => {
            console.error('SSE error:', error);
            toast.error('Failed to connect to deployment updates');
            sse.close();
        };

        return () => {
            sse.close();
        };
    }, []);

    return <Toaster />
}