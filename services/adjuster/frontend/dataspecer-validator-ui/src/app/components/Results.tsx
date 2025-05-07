'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DetectedChangesDto, SuggestionsDto } from '../services/api'

export default function Results() {
  const [changes, setChanges] = useState<DetectedChangesDto | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionsDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const storedChanges = sessionStorage.getItem('detectedChanges')
    const storedSuggestions = sessionStorage.getItem('suggestions')

    if (!storedChanges || !storedSuggestions) {
      setError('No results found. Please upload files first.')
      return
    }

    try {
      setChanges(JSON.parse(storedChanges))
      setSuggestions(JSON.parse(storedSuggestions))
    } catch {
      setError('Error loading results. Please try again.')
    }
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-red-600">{error}</div>
            <button
              onClick={() => router.push('/')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Back to Upload
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!changes || !suggestions) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="animate-pulse">Loading results...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Detected Changes</h2>
          <div className="space-y-4">
            {changes.changes.map((change) => (
              <div
                key={change.changeId}
                className={`p-4 rounded-lg ${
                  change.isAcceptable ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{change.type}</span>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      change.isAcceptable
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {change.isAcceptable ? 'Acceptable' : 'Not Acceptable'}
                  </span>
                </div>
                <p className="mt-2 text-gray-600">{change.description}</p>
                <p className="mt-1 text-sm text-gray-500">Path: {change.path}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Suggested Adjustments</h2>
          <div className="space-y-4">
            {suggestions.suggestions.map((suggestion) => (
              <div key={suggestion.changeId} className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Change ID: {suggestion.changeId}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    Confidence: {Math.round(suggestion.confidence * 100)}%
                  </span>
                </div>
                <p className="mt-2 text-gray-600">{suggestion.suggestion}</p>
                <p className="mt-1 text-sm text-gray-500">{suggestion.rationale}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Back to Upload
          </button>
        </div>
      </div>
    </div>
  )
} 