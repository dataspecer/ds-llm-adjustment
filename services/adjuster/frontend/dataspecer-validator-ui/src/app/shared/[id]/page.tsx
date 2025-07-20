'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, SchemaChangeDto, ChangeType, SharedAnalysisDto, ChangeDecisionDto } from '../../services/api'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface DetectedChange {
  changeId: string;
  type: ChangeType[] | string[];
  path: string;
  description: string;
  isAcceptable: boolean;
  groupId?: string;
}

// Use the ChangeDecisionDto from API for local decisions mapping
type LocalChangeDecision = ChangeDecisionDto;

export default function SharedAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const [analysis, setAnalysis] = useState<SharedAnalysisDto | null>(null)
  const [decisions, setDecisions] = useState<Map<string, LocalChangeDecision>>(new Map())
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)
  const [highlightMap, setHighlightMap] = useState<{ [key: number]: DetectedChange }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load shared analysis
  useEffect(() => {
    const loadSharedAnalysis = async () => {
      if (!params.id) return

      setLoading(true)
      try {
        const response = await api.getSharedAnalysis(params.id as string)
        
        if (response.error) {
          throw new Error(response.error)
        }

        if (response.data) {
          setAnalysis(response.data)
          
          // Convert decisions array to Map if available
          if (response.data.decisions) {
            const decisionsMap = new Map<string, LocalChangeDecision>()
            response.data.decisions.forEach((decision: ChangeDecisionDto) => {
              decisionsMap.set(decision.changeId, decision)
            })
            setDecisions(decisionsMap)
          }
        }
      } catch (err) {
        console.error('Failed to load shared analysis:', err)
        setError(err instanceof Error ? err.message : 'Failed to load shared analysis')
      } finally {
        setLoading(false)
      }
    }

    loadSharedAnalysis()
  }, [params.id])

  // Build highlight map for schema
  useEffect(() => {
    if (!analysis?.schema || !analysis.changes.length) return;
    
    const lines = analysis.schema.split('\n');
    const map: { [key: number]: DetectedChange } = {};

    analysis.changes.forEach(change => {
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
  }, [analysis]);

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

  // Decision counts
  const acceptedChanges = Array.from(decisions.values()).filter(d => d.decision === 'accept')
  const rejectedChanges = Array.from(decisions.values()).filter(d => d.decision === 'reject')
  const developerChanges = Array.from(decisions.values()).filter(d => d.decision === 'developer')

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Analysis Not Found</h2>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Go Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading shared analysis...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-gray-400">No analysis data found.</div>
      </div>
    )
  }

  const selectedChange = analysis.changes.find(c => c.id === selectedChangeId)

  return (
    <div className="flex flex-col h-screen bg-zinc-900">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg text-white">Dataspecer</span>
          <span className="text-lg text-gray-300">Adjuster</span>
          <span className="text-sm text-gray-400">• Shared Analysis</span>
        </div>
        <div className="flex space-x-2">
          <div className="text-sm text-gray-400">
            Shared by Specification Maintainer
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded text-white font-medium"
            style={{ background: '#636E83' }}
          >
            Back to Home
          </button>
        </div>
      </nav>
      
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-zinc-800 flex flex-col min-h-0">
          <div className="p-6 pb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-100">JSON Schema</h2>
            <p className="text-sm text-gray-400">
              {analysis.changes.length} changes detected • Click highlighted lines for details
            </p>
            <div className="text-xs text-gray-500 mt-1">
              Comparing {analysis.newSchemaName} with {analysis.psmFileName}
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
                  onClick: () => {
                    const change = highlightMap[lineNumber];
                    if (change) setSelectedChangeId(change.changeId);
                  }
                };
              }}
            >
              {analysis.schema}
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
              <div className="space-y-4">
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
                  <h3 className="font-semibold text-white mb-3">Maintainer Decision</h3>
                  {(() => {
                    const decision = decisions.get(selectedChange.id);
                    if (!decision) {
                      return (
                        <div className="text-gray-400">
                          <span className="px-3 py-2 text-sm bg-gray-600 bg-opacity-50 text-gray-300 rounded">
                            No decision made
                          </span>
                        </div>
                      );
                    }

                    const getDecisionStyle = (decision: string) => {
                      switch (decision) {
                        case 'accept':
                          return 'bg-green-600 text-white';
                        case 'reject':
                          return 'bg-red-600 text-white';
                        case 'developer':
                          return 'bg-yellow-600 text-white';
                        default:
                          return 'bg-gray-600 text-white';
                      }
                    };

                    const getDecisionLabel = (decision: string) => {
                      switch (decision) {
                        case 'accept':
                          return 'Accepted';
                        case 'reject':
                          return 'Rejected';
                        case 'developer':
                          return 'Flagged for Dev';
                        default:
                          return 'Unknown';
                      }
                    };

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-2 text-sm rounded ${getDecisionStyle(decision.decision)}`}>
                            {getDecisionLabel(decision.decision)}
                          </span>
                        </div>
                        {decision.comment && (
                          <div>
                            <div className="text-sm text-gray-300 mb-1">Comment:</div>
                            <div className="text-sm text-gray-400 bg-zinc-700 p-2 rounded">
                              {decision.comment}
                            </div>
                          </div>
                        )}
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
    </div>
  )
} 