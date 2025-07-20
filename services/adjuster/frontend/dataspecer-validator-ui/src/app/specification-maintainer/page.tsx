'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api, SchemaChangeDto, ChangeType } from '../services/api'
import { ChangeDecision } from '../types/specification-maintainer'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import LlmChat from '../components/LlmChat'

interface FileState {
  content: string | null;
  name: string | null;
}

interface DetectedChange {
  changeId: string;
  type: ChangeType[] | string[];
  path: string;
  description: string;
  isAcceptable: boolean;
  groupId?: string;
}

function SpecificationMaintainerContent() {
  const searchParams = useSearchParams()
  const [oldSchema, setOldSchema] = useState<FileState>({ content: null, name: null });
  const [newSchema, setNewSchema] = useState<FileState>({ content: null, name: null });
  const [psmFile, setPsmFile] = useState<FileState>({ content: null, name: null });
  
  // States for the results view
  const [changes, setChanges] = useState<SchemaChangeDto[]>([])
  const [decisions, setDecisions] = useState<Map<string, ChangeDecision>>(new Map())
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)
  const [highlightMap, setHighlightMap] = useState<{ [key: number]: DetectedChange }>({})
  const [loading, setLoading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingPsm, setIsLoadingPsm] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [commentInputs, setCommentInputs] = useState<Map<string, string>>(new Map())
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatSelectedChanges, setChatSelectedChanges] = useState<string[]>([])

  // Regeneration state for change descriptions
  const [regenerationFeedback, setRegenerationFeedback] = useState<Map<string, string>>(new Map())
  const [isRegeneratingMap, setIsRegeneratingMap] = useState<Map<string, boolean>>(new Map())
  const [regenerationErrors, setRegenerationErrors] = useState<Map<string, string>>(new Map())

  // Auto-load PSM from URL
  useEffect(() => {
    const psmIri = searchParams.get('data-psm-schema')
    
    if (psmIri && !psmFile.content) {
      setIsLoadingPsm(true)
      api.fetchPsmFromIri(psmIri)
        .then(response => {
          if (response.data) {
            setPsmFile({
              content: response.data.content,
              name: response.data.name
            })
          } else if (response.error) {
            setError(`Failed to load PSM from IRI: ${response.error}`)
          }
        })
        .catch(err => {
          setError(`Failed to load PSM from IRI: ${err.message}`)
        })
        .finally(() => {
          setIsLoadingPsm(false)
        })
    }
  }, [searchParams, psmFile.content])

  // Build highlight map for schema
  useEffect(() => {
    if (!newSchema.content || !changes.length) return;
    
    const lines = newSchema.content.split('\n');
    const map: { [key: number]: DetectedChange } = {};

    changes.forEach(change => {
      const targetProperty = extractTargetProperty(change.path);
      
      if (targetProperty) {
        const needsObjectHighlight = change.type === 'type-change';
        
        if (needsObjectHighlight) {
          highlightTargetObject(lines, targetProperty, change, map);
        } else {
          highlightPropertyLine(lines, targetProperty, change, map);
        }
      }
    });

    setHighlightMap(map);
  }, [changes, newSchema.content]);

  // Extract the most specific property name that should be highlighted
  const extractTargetProperty = (path: string): string => {
    const parts = path.split('.');
    
    const propertiesIndices = parts
      .map((part, index) => part === 'properties' ? index : -1)
      .filter(index => index !== -1);
    
    if (propertiesIndices.length === 0) return '';
    
    const lastPropertiesIndex = propertiesIndices[propertiesIndices.length - 1];
    
    if (lastPropertiesIndex + 1 < parts.length) {
      return parts[lastPropertiesIndex + 1];
    }
    
    const firstPropertiesIndex = propertiesIndices[0];
    if (firstPropertiesIndex + 1 < parts.length) {
      return parts[firstPropertiesIndex + 1];
    }
    
    return '';
  };

  const highlightTargetObject = (lines: string[], propName: string, change: SchemaChangeDto, map: { [key: number]: DetectedChange }) => {
    let objectStart = -1;
    let objectEnd = -1;
    
    lines.forEach((line, idx) => {
      if (line.includes(`"${propName}"`) && line.includes(':') && objectStart === -1) {
        objectStart = idx;
      }
    });
    
    if (objectStart === -1) return;
    
    const startLine = lines[objectStart];
    const isObject = startLine.includes('{') || 
                    (objectStart + 1 < lines.length && lines[objectStart + 1].trim().startsWith('{'));
    
    if (!isObject) {
      map[objectStart + 1] = {
        changeId: change.id,
        type: [change.type],
        path: change.path,
        description: change.description,
        isAcceptable: change.isAcceptable,
        groupId: change.groupId
      };
      return;
    }
    
    let braceCount = 0;
    let foundFirstBrace = false;
    const maxLinesToCheck = 10;
    let linesChecked = 0;
    
    for (let i = objectStart; i < lines.length && linesChecked < maxLinesToCheck; i++) {
      const line = lines[i];
      linesChecked++;
      
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      if (openBraces > 0) {
        foundFirstBrace = true;
      }
      
      if (foundFirstBrace) {
        braceCount += openBraces - closeBraces;
        
        if (braceCount === 0) {
          objectEnd = i;
          break;
        }
      }
    }
    
    if (objectEnd !== -1) {
      const linesToHighlight = objectEnd - objectStart + 1;
      if (linesToHighlight > 8) {
        for (let i = objectStart; i < objectStart + 3; i++) {
          map[i + 1] = {
            changeId: change.id,
            type: [change.type],
            path: change.path,
            description: change.description,
            isAcceptable: change.isAcceptable,
            groupId: change.groupId
          };
        }
      } else {
        for (let i = objectStart; i <= objectEnd; i++) {
          map[i + 1] = {
            changeId: change.id,
            type: [change.type],
            path: change.path,
            description: change.description,
            isAcceptable: change.isAcceptable,
            groupId: change.groupId
          };
        }
      }
    } else {
      map[objectStart + 1] = {
        changeId: change.id,
        type: [change.type],
        path: change.path,
        description: change.description,
        isAcceptable: change.isAcceptable,
        groupId: change.groupId
      };
    }
  };

  const highlightPropertyLine = (lines: string[], propName: string, change: SchemaChangeDto, map: { [key: number]: DetectedChange }) => {
    lines.forEach((line, idx) => {
      if (line.includes(`"${propName}"`)) {
        map[idx + 1] = {
          changeId: change.id,
          type: [change.type],
          path: change.path,
          description: change.description,
          isAcceptable: change.isAcceptable,
          groupId: change.groupId
        };
      }
    });
  };

  // Load changes function
  const loadChanges = useCallback(async () => {
    if (!oldSchema.content || !newSchema.content || !psmFile.content) return
    
    setLoading(true)
    
    try {
      const newAnalysisId = Date.now().toString()
      
      const changesResponse = await api.detectChanges(
        oldSchema.content,
        newSchema.content,
        psmFile.content,
        newAnalysisId
      )

      if (changesResponse.error) {
        throw new Error(changesResponse.error)
      }

      if (!changesResponse.data) {
        throw new Error('No changes detected')
      }

      const suggestionsResponse = await api.getSuggestions(
        changesResponse.data,
        psmFile.content
      )

      if (suggestionsResponse.error) {
        throw new Error(suggestionsResponse.error)
      }

      const transformedChanges: SchemaChangeDto[] = changesResponse.data.changes.map((change) => ({
        id: change.changeId,
        type: Array.isArray(change.type) ? change.type[0] as 'addition' | 'removal' | 'rename' | 'type-change' : change.type as 'addition' | 'removal' | 'rename' | 'type-change',
        path: change.path,
        description: change.description,
        isAcceptable: change.isAcceptable,
        isProblematic: !change.isAcceptable,
        groupId: change.groupId,
        suggestion: suggestionsResponse.data?.suggestions.find(s => s.changeId === change.changeId)?.suggestion,
        rationale: suggestionsResponse.data?.suggestions.find(s => s.changeId === change.changeId)?.rationale,
      }))

      setChanges(transformedChanges)
      setAnalysisId(newAnalysisId)
    } catch (error) {
      console.error('Failed to load changes:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }, [oldSchema.content, newSchema.content, psmFile.content])

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (state: FileState) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      setError('Please upload a valid JSON file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setFile({ content: text, name: file.name });
      setError(null);
    };
    reader.readAsText(file);
  };

  // Decision handling function
  const findNextUnprocessedChange = useCallback(() => {
    const currentIndex = changes.findIndex(change => change.id === selectedChangeId)
    const nextChanges = changes.slice(currentIndex + 1)
    const remainingChanges = changes.slice(0, currentIndex)
    
    // First, look for changes after the current one
    for (const change of nextChanges) {
      if (!decisions.has(change.id)) {
        return change.id
      }
    }
    
    // If no changes after current, look from the beginning
    for (const change of remainingChanges) {
      if (!decisions.has(change.id)) {
        return change.id
      }
    }
    
    return null
  }, [changes, selectedChangeId, decisions])

  const scrollToChange = useCallback((changeId: string) => {
    // Find the change in the left panel (syntax highlighter)
    const changeItem = changes.find(c => c.id === changeId)
    if (changeItem) {
      // Try to find the line number in the highlight map
      const lineNumber = Object.keys(highlightMap).find(lineNum => 
        highlightMap[parseInt(lineNum)].changeId === changeId
      )
      
      if (lineNumber) {
        const lineElement = document.querySelector(`[data-line-number="${lineNumber}"]`)
        if (lineElement) {
          lineElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          })
        }
      }
    }
    
    // Also scroll to the change in the right panel if it exists
    const changeElement = document.querySelector(`[data-change-id="${changeId}"]`)
    if (changeElement) {
      changeElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
    }
  }, [changes, highlightMap])

  const handleDecision = useCallback((changeId: string, decision: 'accept' | 'reject' | 'developer', comment?: string) => {
    const newDecisions = new Map(decisions)
    const finalComment = comment || commentInputs.get(changeId) || undefined
    newDecisions.set(changeId, { changeId, decision, comment: finalComment })
    setDecisions(newDecisions)
    
    // Clear the comment input after making decision
    const newCommentInputs = new Map(commentInputs)
    newCommentInputs.delete(changeId)
    setCommentInputs(newCommentInputs)
    
    // Find and scroll to next unprocessed change
    const nextChangeId = findNextUnprocessedChange()
    if (nextChangeId) {
      setTimeout(() => {
        setSelectedChangeId(nextChangeId)
        scrollToChange(nextChangeId)
      }, 300) // Small delay to allow UI to update
    }
  }, [decisions, commentInputs, findNextUnprocessedChange, scrollToChange, setSelectedChangeId, setCommentInputs])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentIndex = changes.findIndex(change => change.id === selectedChangeId)
      
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          if (currentIndex < changes.length - 1) {
            const nextChange = changes[currentIndex + 1]
            setSelectedChangeId(nextChange.id)
            scrollToChange(nextChange.id)
          }
          break
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          if (currentIndex > 0) {
            const prevChange = changes[currentIndex - 1]
            setSelectedChangeId(prevChange.id)
            scrollToChange(prevChange.id)
          }
          break
        case '1':
          e.preventDefault()
          if (selectedChangeId) {
            handleDecision(selectedChangeId, 'accept')
          }
          break
        case '2':
          e.preventDefault()
          if (selectedChangeId) {
            handleDecision(selectedChangeId, 'reject')
          }
          break
        case '3':
          e.preventDefault()
          if (selectedChangeId) {
            handleDecision(selectedChangeId, 'developer')
          }
          break
        case 'n':
          e.preventDefault()
          const nextUnprocessed = findNextUnprocessedChange()
          if (nextUnprocessed) {
            setSelectedChangeId(nextUnprocessed)
            scrollToChange(nextUnprocessed)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedChangeId, changes, decisions, findNextUnprocessedChange, handleDecision, scrollToChange])

  const updateComment = (changeId: string, comment: string) => {
    const newCommentInputs = new Map(commentInputs)
    newCommentInputs.set(changeId, comment)
    setCommentInputs(newCommentInputs)
  }

  // Helper functions for regeneration state
  const updateRegenerationFeedback = (changeId: string, feedback: string) => {
    const newMap = new Map(regenerationFeedback)
    if (feedback.trim()) {
      newMap.set(changeId, feedback)
    } else {
      newMap.delete(changeId)
    }
    setRegenerationFeedback(newMap)
  }

  const setIsRegenerating = (changeId: string, isRegenerating: boolean) => {
    const newMap = new Map(isRegeneratingMap)
    if (isRegenerating) {
      newMap.set(changeId, true)
    } else {
      newMap.delete(changeId)
    }
    setIsRegeneratingMap(newMap)
  }

  const setRegenerationError = (changeId: string, error: string | null) => {
    const newMap = new Map(regenerationErrors)
    if (error) {
      newMap.set(changeId, error)
    } else {
      newMap.delete(changeId)
    }
    setRegenerationErrors(newMap)
  }

  // Decision counts
  const acceptedChanges = Array.from(decisions.values()).filter(d => d.decision === 'accept')
  const rejectedChanges = Array.from(decisions.values()).filter(d => d.decision === 'reject')
  const developerChanges = Array.from(decisions.values()).filter(d => d.decision === 'developer')

  const handleShare = async () => {
    if (!analysisId || changes.length === 0 || !newSchema.content) return

    setIsSharing(true)
    try {
      const storeResponse = await api.storeAnalysis({
        analysisId,
        oldSchemaName: oldSchema.name || 'old-schema.json',
        newSchemaName: newSchema.name || 'new-schema.json', 
        psmFileName: psmFile.name || 'psm.json',
        changes,
        schema: newSchema.content,
        decisions: Array.from(decisions.values())
      })

      if (storeResponse.error) {
        throw new Error(storeResponse.error)
      }

      if (storeResponse.data) {
        console.log('Store response data:', storeResponse.data)
        
        // Build the full share URL if needed
        const shareUrl = storeResponse.data.shareUrl.startsWith('http') 
          ? storeResponse.data.shareUrl 
          : `${window.location.origin}/shared/${storeResponse.data.shareUrl}`
        
        console.log('Attempting to copy to clipboard:', shareUrl)
        
        try {
          // Try using the Clipboard API first
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(shareUrl)
            console.log('Successfully copied to clipboard using Clipboard API')
          } else {
            // Fallback for non-secure contexts or older browsers
            const textArea = document.createElement('textarea')
            textArea.value = shareUrl
            textArea.style.position = 'fixed'
            textArea.style.opacity = '0'
            document.body.appendChild(textArea)
            textArea.focus()
            textArea.select()
            document.execCommand('copy')
            document.body.removeChild(textArea)
            console.log('Successfully copied to clipboard using fallback method')
          }
          
          setShareUrl(shareUrl)
          alert('Share link copied to clipboard!')
        } catch (clipboardError) {
          console.error('Clipboard operation failed:', clipboardError)
          // Still set the share URL so user can manually copy it
          setShareUrl(shareUrl)
          alert(`Failed to copy to clipboard. Please copy this link manually: ${shareUrl}`)
        }
      }
    } catch (err) {
      console.error('Share operation failed:', err)
      setError('Failed to create share link: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsSharing(false)
    }
  }

  const onBack = () => {
    setChanges([])
    setDecisions(new Map())
    setSelectedChangeId(null)
    setAnalysisId(null)
    setShareUrl(null)
    setError(null)
    setHighlightMap({})
  }

  function getLineStyle(lineNumber: number) {
    const change = highlightMap[lineNumber];

    if (!change) 
      return {};

    const changeTypes = Array.isArray(change.type) ? change.type : [change.type];
    
    const hasAddition = changeTypes.some(type => 
      type === 'addition'
    );
    const hasRemoval = changeTypes.some(type => 
      type === 'removal'
    );
    const hasRename = changeTypes.some(type => 
      type === 'rename'
    );
    const hasTypeChange = changeTypes.some(type => 
      type === 'type-change'
    );
    
    const baseStyle = {
      display: 'block',
      width: '100%',
      paddingLeft: '1rem',
      paddingRight: '1rem',
      marginLeft: '-1rem',
      marginRight: '-1rem',
      cursor: 'pointer'
    };
    
    if (hasAddition) {
      return { 
        ...baseStyle,
        backgroundColor: 'rgba(5, 150, 105, 0.25)',
        borderLeft: '4px solid rgba(5, 150, 105, 0.6)'
      };
    }

    if (hasRemoval) {
      return { 
        ...baseStyle,
        backgroundColor: 'rgba(220, 38, 38, 0.25)',
        borderLeft: '4px solid rgba(220, 38, 38, 0.6)'
      };
    }

    if (hasRename || hasTypeChange) {
      return { 
        ...baseStyle,
        backgroundColor: 'rgba(37, 99, 235, 0.25)',
        borderLeft: '4px solid rgba(37, 99, 235, 0.6)'
      };
    }

    return { 
      ...baseStyle,
      backgroundColor: 'rgba(245, 158, 11, 0.25)',
      borderLeft: '4px solid rgba(245, 158, 11, 0.6)'
    };
  }

  const psmFromDataspecer = searchParams.get('data-psm-schema')

  // Upload form when no analysis done yet
  if (changes.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-900">
        <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg text-white">Dataspecer</span>
            <span className="text-lg text-gray-300">Adjuster</span>
          </div>
        </nav>
        
        <div className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">Specification Maintainer</h1>
              <p className="text-gray-400">Upload schemas to compare and share results with developers</p>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Old JSON Schema *</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => handleFileChange(e, setOldSchema)}
                  className="block w-full text-sm text-gray-200 file:bg-zinc-700 file:border-none file:px-4 file:py-2 file:rounded file:text-white hover:file:bg-zinc-600"
                />
                {oldSchema.name && <p className="text-sm text-green-400 mt-1">✓ {oldSchema.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New JSON Schema *</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => handleFileChange(e, setNewSchema)}
                  className="block w-full text-sm text-gray-200 file:bg-zinc-700 file:border-none file:px-4 file:py-2 file:rounded file:text-white hover:file:bg-zinc-600"
                />
                {newSchema.name && <p className="text-sm text-green-400 mt-1">✓ {newSchema.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  PSM Artifact *
                  {isLoadingPsm && <span className="text-blue-400 ml-2">(Loading from Dataspecer...)</span>}
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => handleFileChange(e, setPsmFile)}
                  disabled={isLoadingPsm}
                  className="block w-full text-sm text-gray-200 file:bg-zinc-700 file:border-none file:px-4 file:py-2 file:rounded file:text-white hover:file:bg-zinc-600 disabled:opacity-50"
                />
                {psmFile.name && (
                  <p className="text-sm text-green-400 mt-1">
                    ✓ {psmFile.name}
                    {psmFromDataspecer && <span className="text-blue-400 ml-2">(Auto-loaded)</span>}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={loadChanges}
                disabled={!oldSchema.content || !newSchema.content || !psmFile.content || loading || isLoadingPsm}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-lg font-medium"
              >
                {loading ? 'Analyzing Changes...' : 'Analyze Changes'}
              </button>
            </div>

            {error && (
              <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}
                  </div>
      </div>

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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Analyzing schema changes...</p>
        </div>
      </div>
    )
  }

  // Main results interface matching page.tsx exactly
  const selectedChange = changes.find(c => c.id === selectedChangeId)

  return (
    <div className="flex flex-col h-screen bg-zinc-900">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg text-white">Dataspecer</span>
          <span className="text-lg text-gray-300">Adjuster</span>
        </div>
        <div className="flex space-x-2">
          {shareUrl && (
            <div className="flex items-center space-x-2 mr-4">
              <div className="text-sm text-green-400">
                ✓ Link created:
              </div>
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="text-xs bg-zinc-700 text-gray-300 px-2 py-1 rounded border border-zinc-600 w-64"
                onClick={(e) => e.currentTarget.select()}
                title="Click to select link"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    alert('Link copied to clipboard!')
                  }).catch(() => {
                    alert('Failed to copy. Please select and copy manually.')
                  })
                }}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
          )}
          <button
            onClick={() => {
              setChatSelectedChanges(changes.map(c => c.id))
              setIsChatOpen(true)
            }}
            disabled={changes.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            💬 Chat about All Changes
          </button>
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isSharing ? 'Creating Link...' : 'Share with Developers'}
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded text-white font-medium"
            style={{ background: '#636E83' }}
          >
            Back to Upload
          </button>
        </div>
      </nav>
      
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-zinc-800 flex flex-col min-h-0">
          <div className="p-6 pb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-100">JSON Schema</h2>
            <p className="text-sm text-gray-400">
              {changes.length} changes detected • Click highlighted lines for details
            </p>
            <div className="text-xs text-gray-500 mt-1">
              Shortcuts: ↑/↓ or j/k navigate • 1 accept • 2 reject • 3 flag • n next unprocessed
            </div>
          </div>
          <div className="flex-1 overflow-auto px-6 min-h-0">
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
                  'data-line-number': lineNumber,
                  onClick: () => {
                    const change = highlightMap[lineNumber];
                    if (change) setSelectedChangeId(change.changeId);
                  }
                };
              }}
            >
              {newSchema.content || ''}
            </SyntaxHighlighter>
          </div>
          <div className="p-6 pt-4 flex-shrink-0">
            <div className="text-sm text-gray-400">
              <span>Legend: </span>
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(5, 150, 105, 0.4)', color: '#065f46' }}>Addition</span>{' '}
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(220, 38, 38, 0.4)', color: '#7f1d1d' }}>Removal</span>{' '}
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.4)', color: '#1e3a8a' }}>Rename/Type Change</span>
            </div>
          </div>
        </div>

        <div className="w-1/2 flex flex-col min-h-0">
          <div className="p-6 pb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-100">Change Details</h2>
            <div className="text-sm text-gray-400 mt-1">
              Accepted: {acceptedChanges.length} • Rejected: {rejectedChanges.length} • Flagged: {developerChanges.length}
            </div>
          </div>
          <div className="flex-1 overflow-auto px-6 min-h-0">
            {selectedChange ? (
              <div className="space-y-4" data-change-id={selectedChange.id}>
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="mb-2 font-semibold text-gray-200">
                    Type: {selectedChange.type.toUpperCase()}
                  </div>
                  <div className="mb-2 text-gray-200">Path: {selectedChange.path}</div>
                  <div className="mb-2 text-gray-200">Description: {selectedChange.description}</div>
                  <div className="mb-2 text-gray-200">
                    Acceptable: {selectedChange.isAcceptable ? (
                      <span className="text-green-400">Yes ✓</span>
                    ) : (
                      <span className="text-red-400">No ⚠</span>
                    )}
                  </div>
                  {selectedChange.groupId && (
                    <div className="mb-2 text-gray-200">Group ID: {selectedChange.groupId}</div>
                  )}
                  {selectedChange.suggestion && (
                    <div className="mb-2">
                      <div className="text-sm text-gray-300 mb-1">Suggestion:</div>
                      <div className="text-sm text-blue-400">{selectedChange.suggestion}</div>
                    </div>
                  )}
                  {selectedChange.rationale && (
                    <div className="mb-2">
                      <div className="text-sm text-gray-300 mb-1">Rationale:</div>
                      <div className="text-sm text-gray-400">{selectedChange.rationale}</div>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-3">Improve Change Description</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Provide feedback on the current change description to get an improved AI-generated analysis.
                  </p>
                  
                                    {(() => {
                    const feedback = regenerationFeedback.get(selectedChange.id) || '';
                    const isRegenerating = isRegeneratingMap.get(selectedChange.id) || false;
                    const regenerationError = regenerationErrors.get(selectedChange.id) || null;

                    const handleRegenerate = async () => {
                      if (!feedback.trim()) {
                        setRegenerationError(selectedChange.id, 'Please provide feedback about what should be improved.');
                        return;
                      }

                      setIsRegenerating(selectedChange.id, true);
                      setRegenerationError(selectedChange.id, null);

                      try {
                        const response = await api.regenerateChangeDescription(
                          selectedChange.id,
                          feedback.trim(),
                          selectedChange
                        );

                        if (response.error) {
                          throw new Error(response.error);
                        }

                        if (response.data && response.data.updatedChange) {
                          // Update the change in the changes array
                          const updatedChanges = changes.map(c => 
                            c.id === selectedChange.id ? response.data!.updatedChange : c
                          );
                          setChanges(updatedChanges);
                          updateRegenerationFeedback(selectedChange.id, '');
                          setRegenerationError(selectedChange.id, null);
                        }
                      } catch (error) {
                        setRegenerationError(selectedChange.id, error instanceof Error ? error.message : 'Failed to regenerate description');
                      } finally {
                        setIsRegenerating(selectedChange.id, false);
                      }
                    };

                    return (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            What should be improved about this change description?
                          </label>
                          <textarea
                            value={feedback}
                            onChange={(e) => updateRegenerationFeedback(selectedChange.id, e.target.value)}
                            placeholder="E.g., The description is unclear, the acceptability seems wrong, the suggestion is not helpful, etc."
                            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm resize-none focus:outline-none focus:border-blue-500"
                            rows={3}
                          />
                        </div>
                        
                        {regenerationError && (
                          <div className="text-sm text-red-400 bg-red-900 bg-opacity-20 p-2 rounded">
                            {regenerationError}
                          </div>
                        )}
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={handleRegenerate}
                            disabled={isRegenerating || !feedback.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                          >
                            <span>🔄</span>
                            <span>{isRegenerating ? 'Regenerating...' : 'Regenerate Description'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setChatSelectedChanges([selectedChange.id])
                              setIsChatOpen(true)
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                          >
                            <span>💬</span>
                            <span>General Discussion</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-3">Review for Developers</h3>
                  
                  {(() => {
                    const decision = decisions.get(selectedChange.id);
                    const currentComment = commentInputs.get(selectedChange.id) || '';
                    
                    return (
                      <div className="space-y-4">
                        {/* Show existing decision if made */}
                        {decision && (
                          <div className="bg-zinc-700 rounded p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm text-gray-300">Current Decision:</span>
                              <span className={`px-2 py-1 text-xs rounded ${
                                decision.decision === 'accept' ? 'bg-green-600 text-white' :
                                decision.decision === 'reject' ? 'bg-red-600 text-white' :
                                'bg-yellow-600 text-white'
                              }`}>
                                {decision.decision === 'accept' ? 'Accepted' :
                                 decision.decision === 'reject' ? 'Rejected' :
                                 'Flagged for Dev'}
                              </span>
                            </div>
                            {decision.comment && (
                              <div>
                                <div className="text-xs text-gray-400 mb-1">Comment:</div>
                                <div className="text-sm text-gray-300 bg-zinc-600 p-2 rounded">
                                  {decision.comment}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Comment input */}
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            Add Comment {decision ? '(to update decision)' : '(optional)'}
                          </label>
                          <textarea
                            value={currentComment}
                            onChange={(e) => updateComment(selectedChange.id, e.target.value)}
                            placeholder="Add a comment to explain your decision..."
                            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm resize-none focus:outline-none focus:border-blue-500"
                            rows={3}
                          />
                        </div>
                        
                        {/* Decision buttons */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleDecision(selectedChange.id, 'accept')}
                            className={`px-3 py-2 text-sm rounded transition-colors ${
                              decision?.decision === 'accept'
                                ? 'bg-green-600 text-white'
                                : 'bg-green-600 bg-opacity-20 text-green-400 hover:bg-opacity-40'
                            }`}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDecision(selectedChange.id, 'reject')}
                            className={`px-3 py-2 text-sm rounded transition-colors ${
                              decision?.decision === 'reject'
                                ? 'bg-red-600 text-white'
                                : 'bg-red-600 bg-opacity-20 text-red-400 hover:bg-opacity-40'
                            }`}
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleDecision(selectedChange.id, 'developer')}
                            className={`px-3 py-2 text-sm rounded transition-colors ${
                              decision?.decision === 'developer'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-yellow-600 bg-opacity-20 text-yellow-400 hover:bg-opacity-40'
                            }`}
                          >
                            Flag for Dev
                          </button>
                          {decision && (
                            <button
                              onClick={() => {
                                const newDecisions = new Map(decisions)
                                newDecisions.delete(selectedChange.id)
                                setDecisions(newDecisions)
                                // Clear comment input too
                                const newCommentInputs = new Map(commentInputs)
                                newCommentInputs.delete(selectedChange.id)
                                setCommentInputs(newCommentInputs)
                              }}
                              className="px-3 py-2 text-sm rounded bg-gray-600 bg-opacity-20 text-gray-400 hover:bg-opacity-40 transition-colors"
                            >
                              Clear Decision
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-gray-400">Select a highlighted change in the schema to see details here.</div>
            )}
          </div>
        </div>
      </div>

      {/* LLM Chat Modal */}
      <LlmChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        changes={changes}
        selectedChangeIds={chatSelectedChanges}
      />
    </div>
  )
}

export default function SpecificationMaintainerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <SpecificationMaintainerContent />
    </Suspense>
  )
} 