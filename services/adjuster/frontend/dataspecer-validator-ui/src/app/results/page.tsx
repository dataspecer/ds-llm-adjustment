'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DetectedChangesDto, SuggestionsDto, DetectedChange } from '../services/api'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function ResultsPage() {
  const [changes, setChanges] = useState<DetectedChangesDto | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionsDto | null>(null)
  const [schema, setSchema] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)
  const [highlightMap, setHighlightMap] = useState<{ [key: number]: DetectedChange }>({})
  const router = useRouter()

  useEffect(() => {
    const storedChanges = sessionStorage.getItem('detectedChanges')
    const storedSuggestions = sessionStorage.getItem('suggestions')
    const storedSchema = sessionStorage.getItem('originalSchema')

    if (!storedChanges || !storedSuggestions || !storedSchema) {
      setError('No results found. Please upload files first.')
      return
    }

    try {
      setChanges(JSON.parse(storedChanges))
      setSuggestions(JSON.parse(storedSuggestions))
      setSchema(storedSchema)
    } catch {
      setError('Error loading results. Please try again.')
    }
  }, [])

  useEffect(() => {
    if (!schema || !changes) return;
    const lines = schema.split('\n');
    const map: { [key: number]: DetectedChange } = {};

    changes.changes.forEach(change => {
      const pathParts = change.path.split('/');
      const propName = pathParts[pathParts.length - 1];
      lines.forEach((line, idx) => {
        if (
          line.includes(`"${propName}"`) && line.includes(':')
        ) {
          map[idx + 1] = change;
        }
      });
    });

    setHighlightMap(map);

  }, [changes, schema]);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-zinc-800 shadow rounded-lg p-6">
            <div className="text-red-400">{error}</div>
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

  if (!changes || !suggestions || !schema) {
    return (
      <div className="min-h-screen bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-zinc-800 shadow rounded-lg p-6">
            <div className="animate-pulse text-gray-200">Loading results...</div>
          </div>
        </div>
      </div>
    )
  }

  const selectedChange = changes.changes.find(c => c.changeId === selectedChangeId)
  const selectedSuggestion = suggestions.suggestions.find(s => s.changeId === selectedChangeId)

  function getLineStyle(lineNumber: number) {
    const change = highlightMap[lineNumber];

    if (!change) 
      return {};

    if (change.type === 'addition') {
      console.log('addition', change);
      return { background: '#059669', color: '#fff', cursor: 'pointer' };
    }

    if (change.type === 'removal') {
      console.log('removal', change);
      return { background: '#dc2626', color: '#fff', cursor: 'pointer' };
    }

    if (change.type === 'rename' || change.type === 'type-change') {
      console.log('rename/type-change', change);
      return { background: '#2563eb', color: '#fff', cursor: 'pointer' };
    }

    return {};
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-900">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg text-white">Dataspecer</span>
          <span className="text-lg text-gray-300">Adjuster</span>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded text-white font-medium"
          style={{ background: '#636E83' }}
        >
          Reimport
        </button>
      </nav>
      <div className="flex flex-1">
        <div className="w-1/2 p-6 overflow-auto border-r border-zinc-800">
          <h2 className="text-xl font-bold mb-4 text-gray-100">JSON Schema</h2>
          <SyntaxHighlighter
            language="json"
            style={{ ...vscDarkPlus, 'pre[class*="language-"]': { background: '#23272f' } }}
            wrapLines
            showLineNumbers
            lineProps={lineNumber => {
              if (typeof lineNumber !== 'number') return {};
              const style = getLineStyle(lineNumber);
              return {
                style,
                onClick: () => {
                  const change = highlightMap[lineNumber];
                  if (change) setSelectedChangeId(change.changeId);
                }
              };
            }}
          >
            {schema}
          </SyntaxHighlighter>
          <div className="mt-4 text-sm text-gray-400">
            <span>Legend: </span>
            <span className="px-2 py-1 bg-green-900 text-green-200 rounded">Addition</span>{' '}
            <span className="px-2 py-1 bg-red-900 text-red-200 rounded">Removal</span>{' '}
            <span className="px-2 py-1 bg-blue-900 text-blue-200 rounded">Rename/Type Change</span>
          </div>
        </div>

        <div className="w-1/2 p-6 overflow-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-100">Change Details</h2>
          {selectedChange ? (
            <div>
              <div className="mb-2 font-semibold text-gray-200">Type: {selectedChange.type}</div>
              <div className="mb-2 text-gray-200">Path: {selectedChange.path}</div>
              <div className="mb-2 text-gray-200">Description: {selectedChange.description}</div>
              <div className="mb-2 text-gray-200">Acceptable: {selectedChange.isAcceptable ? 'Yes' : 'No'}</div>
              <div className="mb-2 text-gray-200">Group ID: {selectedChange.groupId}</div>
              {selectedSuggestion && (
                <>
                  <div className="mb-2 text-gray-200">Suggestion: {selectedSuggestion.suggestion}</div>
                </>
              )}
            </div>
          ) : (
            <div className="text-gray-400">Select a highlighted change in the schema to see details here.</div>
          )}
          <div className="mt-8">
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white"
              style={{ background: '#636E83' }}
            >
              Back to Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
