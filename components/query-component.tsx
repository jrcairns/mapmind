"use client"

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function QueryComponent() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    // Simulating an API call
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      // In a real application, you would fetch actual results here
      const newResults = [`Result for "${query}"`, ...results]
      setResults(newResults)
    } catch (error) {
      console.error("Error fetching results:", error)
    } finally {
      setIsLoading(false)
    }
  }, [query, results])

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          type="text"
          placeholder="Enter your query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full"
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Submit Query"
          )}
        </Button>
      </form>
      <div className="border rounded-md p-4 h-64 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-2">Results:</h2>
        {results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((result, index) => (
              <li key={index} className="bg-gray-100 p-2 rounded">
                {result}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No results yet. Submit a query to see results.</p>
        )}
      </div>
    </div>
  )
}