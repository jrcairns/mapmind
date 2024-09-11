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
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Copy } from "lucide-react"
import Image from 'next/image'
import { useParams, useRouter } from "next/navigation"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from "sonner"

async function fetchPageDetails(projectId: string, pageId: string) {
    const response = await fetch(`/api/projects/${projectId}/pages/${pageId}`)
    if (!response.ok) {
        throw new Error('Failed to fetch page details')
    }
    return response.json()
}

export default function PageDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const projectId = params?.id as string
    const pageId = params?.pageId as string

    const { data: pageDetails, isLoading, error } = useQuery({
        queryKey: ['pageDetails', projectId, pageId],
        queryFn: () => fetchPageDetails(projectId, pageId),
    })

    const handleCopyToClipboard = (data: any) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        toast.success("Copied to clipboard")
    }

    const content = () => {
        if (isLoading) return <div>Loading...</div>
        if (error) return <div>Error: {(error as Error).message}</div>

        return (
            <>
                <div className="flex items-center mb-6">
                    <Button variant="ghost" onClick={() => router.back()} className="mr-4">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <h1 className="text-2xl font-semibold text-gray-900">Page Details</h1>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>{pageDetails.name}</CardTitle>
                        <CardDescription>Detailed information about this location</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {pageDetails.photo && (
                                <div className="w-full h-64 relative">
                                    <Image
                                        src={pageDetails.photo.url}
                                        alt={pageDetails.name}
                                        layout="fill"
                                        objectFit="cover"
                                        className="rounded-lg"
                                    />
                                </div>
                            )}
                            <p><strong>Address:</strong> {pageDetails.formatted_address}</p>
                            <p><strong>Phone:</strong> {pageDetails.formatted_phone_number || 'N/A'}</p>
                            <p><strong>Rating:</strong> {pageDetails.rating || 'N/A'}</p>
                            <p><strong>Website:</strong> {pageDetails.website || 'N/A'}</p>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger>View Raw Data</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="relative">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="absolute top-2 right-2 z-10"
                                                onClick={() => handleCopyToClipboard(pageDetails)}
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
                                                {JSON.stringify(pageDetails, null, 2)}
                                            </SyntaxHighlighter>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
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