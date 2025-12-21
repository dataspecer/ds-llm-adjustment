'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, AcceptedChangeDto } from '../services/api'

// #region Public Methods
export default function AcceptedChangesPage() {
  // #region Private Properties
  const router = useRouter()
  const [acceptedChanges, setAcceptedChanges] = useState<AcceptedChangeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedChange, setSelectedChange] = useState<AcceptedChangeDto | null>(null)
  const [psmPreviews, setPsmPreviews] = useState<Record<string, { loading: boolean; error: string | null; content: string | null; expanded: boolean }>>({})

  // #endregion

  // #region Public Methods
  useEffect(() => {
    loadAcceptedChanges()
  }, [])

  const loadAcceptedChanges = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.getAcceptedChanges()
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      if (response.data) {
        setAcceptedChanges(response.data.acceptedChanges)
      }
    } catch (error) {
      console.error('Failed to load accepted changes:', error)
      setError(error instanceof Error ? error.message : 'Failed to load accepted changes')
    } finally {
      setLoading(false)
    }
  }

  const togglePreviewPsm = async (analysisId: string) => {
    setPsmPreviews(prev => {
      const curr = prev[analysisId];
      // Toggle expanded; if not existing, set loading and expanded
      if (!curr) {
        return { ...prev, [analysisId]: { loading: true, error: null, content: null, expanded: true } };
      }
      return { ...prev, [analysisId]: { ...curr, expanded: !curr.expanded } };
    });
    // If content is already loaded, and we just toggled, don't refetch
    const state = psmPreviews[analysisId];
    if (state && state.content) return;
    try {
      const resp = await api.previewPsm(analysisId);
      if (resp.error) {
        throw new Error(resp.error);
      }
      const content = resp.data?.content ?? '';
      setPsmPreviews(prev => ({ ...prev, [analysisId]: { loading: false, error: null, content, expanded: true } }));
    } catch (e) {
      setPsmPreviews(prev => ({ ...prev, [analysisId]: { loading: false, error: e instanceof Error ? e.message : 'Failed to preview PSM', content: null, expanded: true } }));
    }
  }

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'addition': return 'text-green-200 bg-green-400/10'
      case 'removal': return 'text-red-200 bg-red-400/10'
      case 'rename': return 'text-blue-200 bg-blue-400/10'
      case 'type-change': return 'text-yellow-200 bg-yellow-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'addition': return '+'
      case 'removal': return '-'
      case 'rename': return '↔'
      case 'type-change': return '~'
      default: return '?'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const groupChangesByAnalysis = (changes: AcceptedChangeDto[]) => {
    const groups = new Map<string, AcceptedChangeDto[]>()
    
    changes.forEach(change => {
      if (!groups.has(change.analysisId)) {
        groups.set(change.analysisId, [])
      }
      groups.get(change.analysisId)!.push(change)
    })
    
    return Array.from(groups.entries()).map(([analysisId, changes]) => ({
      analysisId,
      changes,
      timestamp: changes[0].timestamp,
      oldSchemaName: changes[0].oldSchemaName,
      newSchemaName: changes[0].newSchemaName,
      psmFileName: changes[0].psmFileName
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }
  // #endregion

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading accepted changes...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
              <p className="text-gray-400 mb-4">{error}</p>
              <button
                onClick={loadAcceptedChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const analysisGroups = groupChangesByAnalysis(acceptedChanges)

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Navigation Header */}
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center space-x-2 px-3 py-1 rounded text-sm transition-colors text-gray-400 hover:text-white hover:bg-zinc-700"
          >
            <span>←</span>
            <span>Back to Home</span>
          </button>
          <div className="border-l border-zinc-600 h-6"></div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg text-white">Dataspecer</span>
            <span className="text-lg text-gray-300">Adjuster</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push('/evaluation/diff')}
            className="px-3 py-1 rounded text-sm transition-colors text-gray-200 bg-blue-600 hover:bg-blue-700"
          >
            Evaluate Diff
          </button>
          <button
            onClick={() => router.push('/evaluation/ux')}
            className="px-3 py-1 rounded text-sm transition-colors text-gray-200 bg-green-600 hover:bg-green-700"
          >
            UX Survey
          </button>
          <span className="text-sm text-gray-400 ml-2">Accepted Changes</span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Accepted Changes</h1>
          <p className="text-gray-400">
            All accepted changes from specification reviews ({acceptedChanges.length} total changes across {analysisGroups.length} analyses)
          </p>
          <button
            onClick={loadAcceptedChanges}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {analysisGroups.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-6xl mb-4">📋</div>
            <h2 className="text-xl text-gray-400 mb-2">No accepted changes found</h2>
            <p className="text-gray-500">
              No changes have been accepted in any specification reviews yet.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {analysisGroups.map((group) => (
              <div key={group.analysisId} className="bg-zinc-800 rounded-lg shadow-lg overflow-hidden">
                {/* Analysis Header */}
                <div className="bg-zinc-700 px-6 py-4 border-b border-zinc-600">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-semibold text-white mb-2">
                        Analysis: {group.analysisId}
                      </h2>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                        <span>📄 Old: {group.oldSchemaName}</span>
                        <span>📄 New: {group.newSchemaName}</span>
                        <span>🔧 PSM: {group.psmFileName}</span>
                        <span>⏰ {formatTimestamp(group.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePreviewPsm(group.analysisId)}
                        className="px-3 py-1 rounded text-sm transition-colors text-gray-200 bg-indigo-600 hover:bg-indigo-700"
                      >
                        {psmPreviews[group.analysisId]?.expanded ? 'Hide PSM Preview' : 'Preview PSM'}
                      </button>
                      <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">
                        {group.changes.length} accepted
                      </span>
                    </div>
                  </div>
                </div>

                {/* PSM Preview */}
                {psmPreviews[group.analysisId]?.expanded && (
                  <div className="px-6 py-4 border-b border-zinc-700 bg-zinc-900/40">
                    {psmPreviews[group.analysisId]?.loading ? (
                      <div className="text-gray-400 text-sm">Generating preview...</div>
                    ) : psmPreviews[group.analysisId]?.error ? (
                      <div className="text-red-400 text-sm">Error: {psmPreviews[group.analysisId]?.error}</div>
                    ) : (
                      <div className="overflow-auto max-h-96">
                        <pre className="text-xs leading-relaxed whitespace-pre text-gray-100 bg-zinc-900 p-4 rounded border border-zinc-700">
{psmPreviews[group.analysisId]?.content}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Changes List */}
                <div className="divide-y divide-zinc-700">
                  {group.changes.map((change, index) => (
                    <div
                      key={change.changeId}
                      className={`p-6 hover:bg-zinc-750 transition-colors cursor-pointer ${
                        selectedChange?.changeId === change.changeId ? 'bg-zinc-750 border-l-4 border-l-blue-500' : ''
                      }`}
                      onClick={() => setSelectedChange(selectedChange?.changeId === change.changeId ? null : change)}
                    >
                      <div className="flex items-start space-x-4">
                        {/* Change Type Badge */}
                        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getChangeTypeColor(change.type)}`}>
                          <span className="font-mono">{getChangeTypeIcon(change.type)}</span>
                          <span className="capitalize">{change.type.replace('-', ' ')}</span>
                        </div>

                        {/* Change Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-sm font-medium text-gray-300">
                              {change.path}
                            </h3>
                            <span className="text-xs text-gray-500 ml-2">
                              ID: {change.changeId}
                            </span>
                          </div>
                          <p className="text-white text-sm mb-2">
                            {change.description}
                          </p>
                          
                          {change.comment && (
                            <div className="bg-zinc-700 rounded p-3 mb-2">
                              <div className="text-xs text-gray-400 mb-1">💬 Review Comment:</div>
                              <p className="text-sm text-gray-200">{change.comment}</p>
                            </div>
                          )}

                          {/* Collapsed/Expanded Details */}
                          {selectedChange?.changeId === change.changeId && (
                            <div className="mt-4 space-y-3">
                              {change.suggestion && (
                                <div className="bg-blue-900/30 border border-blue-800 rounded p-3">
                                  <div className="text-xs text-blue-300 mb-1">💡 AI Suggestion:</div>
                                  <p className="text-sm text-blue-100">{change.suggestion}</p>
                                </div>
                              )}
                              
                              {change.rationale && (
                                <div className="bg-yellow-900/30 border border-yellow-800 rounded p-3">
                                  <div className="text-xs text-yellow-300 mb-1">🤔 Rationale:</div>
                                  <p className="text-sm text-yellow-100">{change.rationale}</p>
                                </div>
                              )}

                              <div className="text-xs text-gray-500 pt-2 border-t border-zinc-600">
                                Click to collapse details
                              </div>
                            </div>
                          )}

                          {selectedChange?.changeId !== change.changeId && (change.suggestion || change.rationale) && (
                            <div className="text-xs text-gray-500 mt-2">
                              Click to see {[change.suggestion && 'suggestion', change.rationale && 'rationale'].filter(Boolean).join(' and ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 