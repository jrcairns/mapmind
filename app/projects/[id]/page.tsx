'use client'

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useDeployment } from "@/hooks/use-deployment"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Trash2 } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { UploadButton } from "@/utils/uploadthing"

async function fetchProject(projectId: string) {
    const vercelResponse = await fetch(`/api/projects/${projectId}`)
    const dbResponse = await fetch(`/api/projects/${projectId}/db`)

    if (!vercelResponse.ok || !dbResponse.ok) {
        throw new Error('Failed to fetch project data')
    }

    const vercelData = await vercelResponse.json()
    const dbData = await dbResponse.json()

    return { ...vercelData, ...dbData, page: dbData.page || {} }
}

async function submitQuery(projectId: string, query: string, promotedPlace: any) {
    const response = await fetch(`/api/projects/${projectId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, promotedPlace }),
    })
    if (!response.ok) {
        throw new Error('Failed to submit query')
    }
    const responseData = await response.json()
    return { query: responseData.query, data: responseData.data }
}

async function updatePageComponents(projectId: string, pageData: any) {
    const response = await fetch(`/api/projects/${projectId}/page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageData),
    });
    if (!response.ok) {
        throw new Error('Failed to update page components');
    }
    return response.json();
}

interface GooglePlaceSearchProps {
    onPlaceSelect: (place: any) => void
    queryMutation: any
}

function GooglePlaceSearch({ onPlaceSelect, queryMutation }: GooglePlaceSearchProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState([])

    const searchMutation = useMutation({
        mutationFn: async (query: string) => {
            const response = await fetch(`/api/google-places-search?query=${encodeURIComponent(query)}`)
            if (!response.ok) throw new Error('Failed to fetch Google Places')
            return response.json()
        },
        onSuccess: (data) => {
            setSearchResults(data.results)
        },
        onError: (error) => {
            console.error('Error searching Google Places:', error)
            toast.error("Failed to search Google Places")
        }
    })

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        searchMutation.mutate(searchQuery)
    }

    const handlePromote = (place: any) => {
        onPlaceSelect(place)
        queryMutation.mutate({ query: searchQuery, promotedPlace: place })
    }

    return (
        <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex space-x-2">
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a place"
                />
                <Button type="submit" disabled={searchMutation.isPending}>
                    {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
            </form>
            {searchResults.length > 0 && (
                <ul className="space-y-2">
                    {searchResults.map((place: any) => (
                        <li key={place.place_id} className="flex justify-between items-center">
                            <span>{place.name}</span>
                            <Button
                                onClick={() => handlePromote(place)}
                                disabled={queryMutation.isPending}
                            >
                                {queryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Promote"}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

const defaultPageData = {
    logo: { url: '' },
    navigation: { links: [] },
    hero: { title: '', description: '', image: { url: '' } },
    cta: { title: '', description: '', image: { url: '' } },
    faqs: [],
    footer: { description: '', links: [] },
};

export default function ProjectPage() {
    const params = useParams()
    const router = useRouter()
    const queryClient = useQueryClient()
    const projectId = params?.id as string
    const [query, setQuery] = useState("")
    const [pageData, setPageData] = useState(defaultPageData)
    const [promotedPlace, setPromotedPlace] = useState<any>(null)

    const { data: project, isLoading, error } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => fetchProject(projectId),
    })

    useEffect(() => {
        if (project?.page) {
            setPageData(prevData => ({
                ...defaultPageData,
                ...project.page,
                navigation: {
                    links: [...(project.page.navigation?.links || [])],
                },
                footer: {
                    description: project.page.footer?.description || '',
                    links: [...(project.page.footer?.links || [])],
                },
            }));
        }
        if (project?.query) {
            setQuery(project.query)
        }
        if (project?.data?.results) {
            const boostedPlace = project.data.results.find((result: any) => result.isBoosted)
            if (boostedPlace) {
                setPromotedPlace(boostedPlace)
            }
        }
    }, [project])

    const deployMutation = useDeployment()

    const queryMutation = useMutation({
        mutationFn: ({ query, promotedPlace }: { query: string, promotedPlace: any }) => submitQuery(projectId, query, promotedPlace),
        onSuccess: (data) => {
            queryClient.setQueryData(['project', projectId], (oldData: any) => ({
                ...oldData,
                query: data.query,
                data: data.data
            }));
            setQuery(data.query);
            setPromotedPlace(data.data.results.find((result: any) => result.isBoosted));
            toast.success("Query and promoted place updated successfully");
        },
        onError: () => {
            toast.error("Failed to update query and promoted place");
        }
    });

    const pageComponentsMutation = useMutation({
        mutationFn: (pageData: any) => updatePageComponents(projectId, pageData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
            toast.success("Page components updated successfully");
        },
        onError: () => {
            toast.error("Failed to update page components");
        }
    });

    const generateContentMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/generate-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, results: project.data.results }),
            });
            if (!response.ok) {
                throw new Error('Failed to generate content');
            }
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let result = '';
            while (true) {
                const { done, value } = await reader?.read();
                if (done) break;
                result += decoder.decode(value);
            }
            return JSON.parse(result);
        },
        onSuccess: (data) => {
            setPageData(data);
            toast.success("Content generated successfully");
        },
        onError: () => {
            toast.error("Failed to generate content");
        }
    });

    const handleDeploy = async () => {
        try {
            await deployMutation.mutateAsync(projectId)
            toast.success("Deployment initiated successfully")
        } catch (error) {
            console.error("Failed to start deployment:", error)
            toast.error("An unexpected error occurred while initiating the deployment.")
        }
    }

    const handleQuerySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        queryMutation.mutate({ query, promotedPlace });
    }

    const handlePageDataChange = (section: string, field: string, value: any) => {
        setPageData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }))
    }

    const handleArrayChange = (section: string, index: number, field: string, value: string) => {
        setPageData(prev => {
            if (section === 'navigation.links' || section === 'footer.links') {
                const [parentSection, childSection] = section.split('.');
                const updatedLinks = [...(prev[parentSection][childSection] || [])];
                updatedLinks[index] = { ...updatedLinks[index], [field]: value };
                return {
                    ...prev,
                    [parentSection]: {
                        ...prev[parentSection],
                        [childSection]: updatedLinks,
                    },
                };
            } else if (section === 'faqs') {
                const updatedFaqs = [...prev.faqs];
                updatedFaqs[index] = { ...updatedFaqs[index], [field]: value };
                return {
                    ...prev,
                    faqs: updatedFaqs,
                };
            }
            return prev;
        });
    }

    const addArrayItem = (section: string, newItem: any) => {
        setPageData(prev => {
            if (section === 'navigation.links' || section === 'footer.links') {
                const [parentSection, childSection] = section.split('.');
                return {
                    ...prev,
                    [parentSection]: {
                        ...prev[parentSection],
                        [childSection]: [...(prev[parentSection][childSection] || []), newItem],
                    },
                };
            } else if (section === 'faqs') {
                return {
                    ...prev,
                    faqs: [...prev.faqs, newItem],
                };
            }
            return prev;
        });
    }

    const removeArrayItem = (section: string, index: number) => {
        setPageData(prev => {
            if (section === 'navigation.links' || section === 'footer.links') {
                const [parentSection, childSection] = section.split('.');
                return {
                    ...prev,
                    [parentSection]: {
                        ...prev[parentSection],
                        [childSection]: prev[parentSection][childSection].filter((_: any, i: number) => i !== index),
                    },
                };
            } else if (section === 'faqs') {
                return {
                    ...prev,
                    faqs: prev.faqs.filter((_: any, i: number) => i !== index),
                };
            }
            return prev;
        });
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        pageComponentsMutation.mutate(pageData);
    }

    const handlePromotedPlaceSelect = (place: any) => {
        setPromotedPlace(place);
        queryMutation.mutate({ query, promotedPlace: place });
    }

    if (isLoading) return <DashboardLayout><div>Loading...</div></DashboardLayout>
    if (error) return <DashboardLayout><div>Error: {(error as Error).message}</div></DashboardLayout>

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center mb-6">
                    <Button variant="ghost" onClick={() => router.back()} className="mr-4">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <h1 className="text-2xl font-semibold text-gray-900">Project Details</h1>
                </div>

                {/* Project Info Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{project.name}</CardTitle>
                        <CardDescription>Project Information</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p><strong>ID:</strong> {project.id}</p>
                            <p><strong>Framework:</strong> {project.framework}</p>
                            <p><strong>Repository:</strong> {project.link?.repo || 'Not connected'}</p>
                            <p><strong>Latest Deployment:</strong> {project.latestDeployments?.[0]?.url || 'No deployments yet'}</p>
                            <Button onClick={handleDeploy} disabled={deployMutation.isPending}>
                                Deploy
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Query Section */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Project Query</CardTitle>
                            <CardDescription>Update the main query for this project</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleQuerySubmit} className="space-y-4">
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Enter your query here"
                                />
                                <Button type="submit" disabled={queryMutation.isPending}>
                                    {queryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Query"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Promoted Place</CardTitle>
                            <CardDescription>Search and select a place to promote</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <GooglePlaceSearch onPlaceSelect={handlePromotedPlaceSelect} queryMutation={queryMutation} />
                            {promotedPlace && (
                                <div className="mt-4 p-4 border rounded-md bg-gray-50">
                                    <h4 className="font-semibold mb-2">Currently Promoted:</h4>
                                    <p>{promotedPlace.name}</p>
                                    <p className="text-sm text-gray-500">{promotedPlace.formatted_address}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {project?.data && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Query Results</CardTitle>
                                <CardDescription>Pages that will be generated based on the query</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    {project.data.results?.map((result: any) => (
                                        <li key={result.place_id} className="flex items-center justify-between">
                                            <Button
                                                variant="link"
                                                className="p-0 h-auto"
                                                onClick={() => router.push(`/projects/${projectId}/${result.place_id}`)}
                                            >
                                                {result.name}
                                            </Button>
                                            {result.isBoosted && (
                                                <span className="text-sm text-green-600 font-semibold">Promoted</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Page Components Section */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Page Components</CardTitle>
                        <CardDescription>Update the components for this project's page</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Accordion type="single" collapsible className="w-full">
                                {/* Logo Section */}
                                <AccordionItem value="logo">
                                    <AccordionTrigger>Logo</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            <UploadButton
                                                endpoint="imageUploader"
                                                onClientUploadComplete={(res) => {
                                                    if (res && res.length > 0) {
                                                        handlePageDataChange('logo', 'url', res[0].url);
                                                        toast.success("Logo uploaded successfully");
                                                    }
                                                }}
                                                onUploadError={(error: Error) => {
                                                    toast.error(`Upload failed: ${error.message}`);
                                                }}
                                            />
                                            {pageData.logo.url && (
                                                <div className="mt-2">
                                                    <img src={pageData.logo.url} alt="Logo preview" className="max-w-xs" />
                                                </div>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* Navigation Section */}
                                <AccordionItem value="navigation">
                                    <AccordionTrigger>Navigation</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            {pageData.navigation.links.map((link: any, index: number) => (
                                                <div key={index} className="flex space-x-2 items-center">
                                                    <Input
                                                        className="flex-1"
                                                        value={link.label}
                                                        onChange={(e) => handleArrayChange('navigation.links', index, 'label', e.target.value)}
                                                        placeholder="Link label"
                                                    />
                                                    <Input
                                                        className="flex-1"
                                                        value={link.url}
                                                        onChange={(e) => handleArrayChange('navigation.links', index, 'url', e.target.value)}
                                                        placeholder="Link URL"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-10 w-10"
                                                        onClick={() => removeArrayItem('navigation.links', index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button
                                                variant="secondary"
                                                type="button"
                                                onClick={() => addArrayItem('navigation.links', { label: '', url: '' })}
                                            >
                                                Add Navigation Link
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* Hero Section */}
                                <AccordionItem value="hero">
                                    <AccordionTrigger>Hero</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            <Input
                                                value={pageData.hero.title}
                                                onChange={(e) => handlePageDataChange('hero', 'title', e.target.value)}
                                                placeholder="Hero title"
                                            />
                                            <Textarea
                                                value={pageData.hero.description}
                                                onChange={(e) => handlePageDataChange('hero', 'description', e.target.value)}
                                                placeholder="Hero description"
                                            />
                                            <UploadButton
                                                endpoint="imageUploader"
                                                onClientUploadComplete={(res) => {
                                                    if (res && res.length > 0) {
                                                        handlePageDataChange('hero', 'image', { url: res[0].url });
                                                        toast.success("Hero image uploaded successfully");
                                                    }
                                                }}
                                                onUploadError={(error: Error) => {
                                                    toast.error(`Upload failed: ${error.message}`);
                                                }}
                                            />
                                            {pageData.hero.image.url && (
                                                <div className="mt-2">
                                                    <img src={pageData.hero.image.url} alt="Hero image preview" className="max-w-xs" />
                                                </div>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* CTA Section */}
                                <AccordionItem value="cta">
                                    <AccordionTrigger>CTA</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            <Input
                                                value={pageData.cta.title}
                                                onChange={(e) => handlePageDataChange('cta', 'title', e.target.value)}
                                                placeholder="CTA title"
                                            />
                                            <Textarea
                                                value={pageData.cta.description}
                                                onChange={(e) => handlePageDataChange('cta', 'description', e.target.value)}
                                                placeholder="CTA description"
                                            />
                                            <UploadButton
                                                endpoint="imageUploader"
                                                onClientUploadComplete={(res) => {
                                                    if (res && res.length > 0) {
                                                        handlePageDataChange('cta', 'image', { url: res[0].url });
                                                        toast.success("CTA image uploaded successfully");
                                                    }
                                                }}
                                                onUploadError={(error: Error) => {
                                                    toast.error(`Upload failed: ${error.message}`);
                                                }}
                                            />
                                            {pageData.cta.image.url && (
                                                <div className="mt-2">
                                                    <img src={pageData.cta.image.url} alt="CTA image preview" className="max-w-xs" />
                                                </div>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* FAQs Section */}
                                <AccordionItem value="faqs">
                                    <AccordionTrigger>FAQs</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            {pageData.faqs.map((faq: any, index: number) => (
                                                <div key={index} className="space-y-2">
                                                    <div className="flex space-x-2 items-center">
                                                        <Input
                                                            className="flex-1"
                                                            value={faq.question}
                                                            onChange={(e) => handleArrayChange('faqs', index, 'question', e.target.value)}
                                                            placeholder="Question"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="h-10 w-10"
                                                            onClick={() => removeArrayItem('faqs', index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <Textarea
                                                        value={faq.answer}
                                                        onChange={(e) => handleArrayChange('faqs', index, 'answer', e.target.value)}
                                                        placeholder="Answer"
                                                    />
                                                </div>
                                            ))}
                                            <Button
                                                variant="secondary"
                                                type="button"
                                                onClick={() => addArrayItem('faqs', { question: '', answer: '' })}
                                            >
                                                Add FAQ
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* Footer Section */}
                                <AccordionItem value="footer">
                                    <AccordionTrigger>Footer</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            <Textarea
                                                value={pageData.footer.description}
                                                onChange={(e) => handlePageDataChange('footer', 'description', e.target.value)}
                                                placeholder="Footer description"
                                            />
                                            {pageData.footer.links.map((link: any, index: number) => (
                                                <div key={index} className="flex space-x-2 items-center">
                                                    <Input
                                                        className="flex-1"
                                                        value={link.label}
                                                        onChange={(e) => handleArrayChange('footer.links', index, 'label', e.target.value)}
                                                        placeholder="Link label"
                                                    />
                                                    <Input
                                                        className="flex-1"
                                                        value={link.url}
                                                        onChange={(e) => handleArrayChange('footer.links', index, 'url', e.target.value)}
                                                        placeholder="Link URL"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-10 w-10"
                                                        onClick={() => removeArrayItem('footer.links', index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button
                                                variant="secondary"
                                                type="button"
                                                onClick={() => addArrayItem('footer.links', { label: '', url: '' })}
                                            >
                                                Add Footer Link
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            <Button type="submit" disabled={pageComponentsMutation.isPending}>
                                {pageComponentsMutation.isPending ? "Updating..." : "Update Page Components"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Button
                    onClick={() => generateContentMutation.mutate()}
                    disabled={generateContentMutation.isPending}
                >
                    {generateContentMutation.isPending ? "Generating..." : "Generate Content"}
                </Button>
            </div>
        </DashboardLayout>
    )
}