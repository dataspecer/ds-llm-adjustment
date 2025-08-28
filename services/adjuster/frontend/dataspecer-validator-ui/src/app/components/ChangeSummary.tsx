'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SelectedSpecification, ChangeDecision } from '../types/specification-maintainer'
import { api, SchemaChangeDto } from '../services/api'
import LlmChat from './LlmChat'

interface ChangeSummaryProps {
  specification: SelectedSpecification
  schema: string
  schemaFileName: string
  onBack: () => void
}

export default function ChangeSummary({ specification, schema, schemaFileName, onBack }: ChangeSummaryProps) {
  const router = useRouter()
  const [changes, setChanges] = useState<SchemaChangeDto[]>([])
  const [decisions, setDecisions] = useState<Map<string, ChangeDecision>>(new Map())
  const [selectedChange, setSelectedChange] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatSelectedChanges, setChatSelectedChanges] = useState<string[]>([])

  const loadChanges = useCallback(async () => {
    setLoading(true)
    
    try {
      const response = await api.analyzeSchema(
        specification.id,
        schema,
        schemaFileName
      )
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      if (response.data) {
        setChanges(response.data.changes)
      }
    } catch (error) {
      console.error('Failed to load changes:', error)
    } finally {
      setLoading(false)
    }
  }, [specification.id, schema, schemaFileName])

  useEffect(() => {
    loadChanges()
  }, [loadChanges])

  const findNextUnprocessedChange = useCallback(() => {
    const currentIndex = changes.findIndex(change => change.id === selectedChange)
    const nextChanges = changes.slice(currentIndex + 1)
    const remainingChanges = changes.slice(0, currentIndex)
    
    for (const change of nextChanges) {
      if (!decisions.has(change.id)) {
        return change.id
      }
    }
    
    for (const change of remainingChanges) {
      if (!decisions.has(change.id)) {
        return change.id
      }
    }
    
    return null
  }, [changes, selectedChange, decisions])

  const scrollToChange = useCallback((changeId: string) => {
    const changeElement = document.querySelector(`[data-change-id="${changeId}"]`)
    if (changeElement) {
      changeElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
    }
  }, [])

  const handleDecision = useCallback((changeId: string, decision: 'accept' | 'reject' | 'developer', comment?: string) => {
    const newDecisions = new Map(decisions)
    newDecisions.set(changeId, { changeId, decision, comment })
    setDecisions(newDecisions)
    
    const nextChangeId = findNextUnprocessedChange()
    if (nextChangeId) {
      setTimeout(() => {
        setSelectedChange(nextChangeId)
        scrollToChange(nextChangeId)
      }, 300) 
    }
  }, [decisions, findNextUnprocessedChange, scrollToChange, setSelectedChange])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentIndex = changes.findIndex(change => change.id === selectedChange)
      
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          if (currentIndex < changes.length - 1) {
            const nextChange = changes[currentIndex + 1]
            setSelectedChange(nextChange.id)
            scrollToChange(nextChange.id)
          }
          break
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          if (currentIndex > 0) {
            const prevChange = changes[currentIndex - 1]
            setSelectedChange(prevChange.id)
            scrollToChange(prevChange.id)
          }
          break
        case '1':
          e.preventDefault()
          if (selectedChange) {
            handleDecision(selectedChange, 'accept')
          }
          break
        case '2':
          e.preventDefault()
          if (selectedChange) {
            handleDecision(selectedChange, 'reject')
          }
          break
        case '3':
          e.preventDefault()
          if (selectedChange) {
            handleDecision(selectedChange, 'developer')
          }
          break
        case 'n':
          e.preventDefault()
          const nextUnprocessed = findNextUnprocessedChange()
          if (nextUnprocessed) {
            setSelectedChange(nextUnprocessed)
            scrollToChange(nextUnprocessed)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedChange, changes, decisions, findNextUnprocessedChange, handleDecision, scrollToChange])

  const getChangeColor = (change: SchemaChangeDto) => {
    switch (change.type) {
      case 'addition': return 'text-green-200'
      case 'removal': return 'text-red-200'
      case 'rename': return 'text-blue-200'
      case 'type-change': return 'text-yellow-200'
      default: return 'text-gray-400'
    }
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'addition': return '+'
      case 'removal': return '-'
      case 'rename': return '↔'
      case 'type-change': return '~'
      default: return '?'
    }
  }

  const highlightedSchema = schema.split('\n').map((line, index) => {
    const lineNumber = index + 1
    const change = changes.find(c => c.lineNumber === lineNumber)
    return { line, lineNumber, change }
  })

  const acceptedChanges = Array.from(decisions.values()).filter(d => d.decision === 'accept')
  const rejectedChanges = Array.from(decisions.values()).filter(d => d.decision === 'reject')
  const developerChanges = Array.from(decisions.values()).filter(d => d.decision === 'developer')

  const handleApplyChanges = async () => {
    if (acceptedChanges.length === 0) return
    
    setIsApplying(true)
    
    try {
      const response = await api.applyChanges(
        specification.id,
        Array.from(decisions.values())
      )
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      if (response.data) {
        alert(response.data.message)
      }
    } catch (error) {
      alert(`Failed to apply changes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsApplying(false)
    }
  }

  const handleExportReport = async () => {
    setIsExporting(true)
    
    try {
      const response = await api.exportReport(
        specification.id,
        Array.from(decisions.values())
      )
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      if (response.data) {
        const blob = new Blob([JSON.stringify(response.data.report, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `change-report-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      alert(`Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleGenerateValidationLink = async () => {
    setIsGeneratingLink(true)
    
    try {
      const response = await api.generateValidationLink(specification.id)
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      if (response.data) {
        await navigator.clipboard.writeText(response.data.url)
        alert('Validation link copied to clipboard!')
      }
    } catch (error) {
      alert(`Failed to generate validation link: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGeneratingLink(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-400">Analyzing schema changes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Change Summary</h2>
          <p className="text-gray-400">
            Comparing {schemaFileName} with {specification.name}
          </p>
          <div className="text-xs text-gray-500 mt-1">
            Shortcuts: ↑/↓ or j/k navigate • 1 accept • 2 reject • 3 flag • n next unprocessed
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => router.push('/accepted-changes')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            📋 View Accepted Changes
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {showPreview ? 'Hide Preview' : 'Preview Changes'}
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Schema with Changes */}
        <div className="bg-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 bg-zinc-700 border-b border-zinc-600">
            <h3 className="font-semibold text-white">JSON Schema with Changes</h3>
            <p className="text-sm text-gray-400">
              {changes.length} changes detected
            </p>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm">
              {highlightedSchema.map(({ line, lineNumber, change }) => (
                <div
                  key={lineNumber}
                  className={`flex ${change ? getChangeColor(change) : 'text-gray-300'} ${
                    selectedChange === change?.id ? 'bg-zinc-700' : ''
                  } ${change ? 'cursor-pointer hover:bg-zinc-700' : ''}`}
                  onClick={() => change && setSelectedChange(change.id)}
                >
                  <span className="w-8 text-xs text-right pr-2 text-gray-500">
                    {lineNumber}
                  </span>
                  {change && (
                    <span className="w-4 text-center">
                      {getChangeIcon(change.type)}
                    </span>
                  )}
                  <span className={change ? 'ml-2' : 'ml-6'}>{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>

        {/* Right Panel - Change Actions */}
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">Changes</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {changes.map((change) => {
                const decision = decisions.get(change.id)
                return (
                  <div
                    key={change.id}
                    data-change-id={change.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedChange === change.id
                        ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                        : 'border-zinc-600 hover:border-zinc-500'
                    } ${change.isProblematic ? 'border-red-500 bg-red-900 bg-opacity-10' : ''}`}
                    onClick={() => setSelectedChange(change.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${getChangeColor(change)} bg-opacity-20`}>
                          {change.type.toUpperCase()}
                        </span>
                        {change.groupId && (
                          <span className="text-xs px-2 py-1 bg-gray-600 text-gray-300 rounded">
                            {change.groupId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {change.isAcceptable && (
                          <span className="text-xs text-green-200">✓</span>
                        )}
                        {change.isProblematic && (
                          <span className="text-xs text-red-200">⚠</span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-white text-sm mb-2">{change.description}</p>
                    <p className="text-xs text-gray-400 mb-3">Path: {change.path}</p>
                    
                    {selectedChange === change.id && (
                      <div className="space-y-3 border-t border-zinc-600 pt-3">
                        {change.suggestion && (
                          <div>
                            <p className="text-sm text-gray-300 mb-1">Suggestion:</p>
                            <p className="text-sm text-blue-400">{change.suggestion}</p>
                          </div>
                        )}
                        {change.rationale && (
                          <div>
                            <p className="text-sm text-gray-300 mb-1">Rationale:</p>
                            <p className="text-sm text-gray-400">{change.rationale}</p>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDecision(change.id, 'accept')
                            }}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              decision?.decision === 'accept'
                                ? 'bg-green-600 text-white'
                                : 'bg-green-600 bg-opacity-20 text-green-200 hover:bg-opacity-40'
                            }`}
                          >
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDecision(change.id, 'reject')
                            }}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              decision?.decision === 'reject'
                                ? 'bg-red-600 text-white'
                                : 'bg-red-600 bg-opacity-20 text-red-200 hover:bg-opacity-40'
                            }`}
                          >
                            Reject
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDecision(change.id, 'developer')
                            }}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              decision?.decision === 'developer'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-yellow-600 bg-opacity-20 text-yellow-400 hover:bg-opacity-40'
                            }`}
                          >
                            Flag for Dev
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setChatSelectedChanges([change.id])
                              setIsChatOpen(true)
                            }}
                            className="px-3 py-1 text-xs rounded bg-purple-600 bg-opacity-20 text-purple-400 hover:bg-opacity-40 transition-colors"
                          >
                            💬 Chat
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3">Decision Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-green-200 font-bold">{acceptedChanges.length}</div>
                <div className="text-gray-400">Accepted</div>
              </div>
              <div>
                <div className="text-red-200 font-bold">{rejectedChanges.length}</div>
                <div className="text-gray-400">Rejected</div>
              </div>
              <div>
                <div className="text-yellow-200 font-bold">{developerChanges.length}</div>
                <div className="text-gray-400">Dev Flagged</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleApplyChanges}
              disabled={acceptedChanges.length === 0 || isApplying}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isApplying ? 'Applying...' : `Apply ${acceptedChanges.length} Changes to Specification`}
            </button>
            
            <button
              onClick={handleExportReport}
              disabled={isExporting}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? 'Exporting...' : 'Export Developer Feedback Report'}
            </button>
            
            <button
              onClick={handleGenerateValidationLink}
              disabled={isGeneratingLink}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingLink ? 'Generating...' : 'Generate Validation Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-4xl max-h-96 overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Updated Specification Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="text-gray-300">
              <p className="mb-4">This is a mock preview of how the specification would look with accepted changes.</p>
              <p className="text-sm text-gray-400">
                In a real implementation, this would show the visual/graphical view of the updated specification.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LLM Chat Component */}
      <LlmChat
        changes={changes}
        selectedChangeIds={chatSelectedChanges}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  )
} 