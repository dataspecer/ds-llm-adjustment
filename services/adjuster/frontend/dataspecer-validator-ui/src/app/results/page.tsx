'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DetectedChangesDto, SuggestionsDto, DetectedChange, ChangeType, api, DiffQualityResultDto } from '../services/api'
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
  const [runId, setRunId] = useState<string>('')
  const [labels, setLabels] = useState<Record<string, 'tp' | 'fp' | 'none'>>({})
  const [fnAddition, setFnAddition] = useState<number>(0)
  const [fnRemoval, setFnRemoval] = useState<number>(0)
  const [fnRename, setFnRename] = useState<number>(0)
  const [fnTypeChange, setFnTypeChange] = useState<number>(0)
  const [evalSaving, setEvalSaving] = useState<boolean>(false)
  const [evalResult, setEvalResult] = useState<DiffQualityResultDto | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)

  useEffect(() => {
    const storedChanges = sessionStorage.getItem('detectedChanges')
    const storedSuggestions = sessionStorage.getItem('suggestions')
    const storedSchema = sessionStorage.getItem('originalSchema')
    // Initialize or reuse runId
    let rid = sessionStorage.getItem('adjusterRunId')
    if (!rid) {
      rid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem('adjusterRunId', rid)
    }
    setRunId(rid || '')

    if (!storedChanges || !storedSuggestions || !storedSchema) {
      setError('No results found. Please upload files first.')
      return
    }

    try {
      const parsedChanges = JSON.parse(storedChanges)
      const parsedSuggestions = JSON.parse(storedSuggestions)
      
      console.log('Parsed changes:', parsedChanges)
      console.log('Parsed suggestions:', parsedSuggestions)
      console.log('Schema length:', storedSchema.length)
      
      setChanges(parsedChanges)
      setSuggestions(parsedSuggestions)
      setSchema(storedSchema)
      const initial: Record<string, 'tp' | 'fp' | 'none'> = {}
      for (const c of (parsedChanges.changes as DetectedChange[])) {
        initial[c.changeId] = 'none'
      }
      setLabels(initial)
    } catch (err) {
      console.error('Error parsing stored data:', err)
      setError('Error loading results. Please try again.')
    }
  }, [])

  useEffect(() => {
    if (!schema || !changes) return;
    
    console.log('Building highlight map for changes:', changes.changes)
    console.log('Schema preview:', schema.substring(0, 300))
    
    const lines = schema.split('\n');
    const map: { [key: number]: DetectedChange } = {};

    changes.changes.forEach(change => {
      console.log('Processing change:', change)
      
      const targetProperty = extractTargetProperty(change.path);
      console.log('Target property to highlight:', targetProperty, 'from path:', change.path)
      
      if (targetProperty) {
        const needsObjectHighlight = change.type.some(type => 
          type === 'type-change' || type === ChangeType.TYPE_CHANGE
        );
        
        if (needsObjectHighlight) {
          highlightTargetObject(lines, targetProperty, change, map);
        } else {
          highlightPropertyLine(lines, targetProperty, change, map);
        }
      }
    });

    console.log('Final highlight map:', map)
    setHighlightMap(map);
  }, [changes, schema]);

  const extractTargetProperty = (path: string): string => {
    
    const parts = path.split('.');
    console.log('Path parts:', parts);
    
    const propertiesIndices = parts
      .map((part, index) => part === 'properties' ? index : -1)
      .filter(index => index !== -1);
    
    console.log('Properties indices:', propertiesIndices);
    
    if (propertiesIndices.length === 0) return '';
    
    const lastPropertiesIndex = propertiesIndices[propertiesIndices.length - 1];
    
    if (lastPropertiesIndex + 1 < parts.length) {
      const targetProp = parts[lastPropertiesIndex + 1];
      console.log('Found target property:', targetProp, 'at last properties section');
      return targetProp;
    }
    
    const firstPropertiesIndex = propertiesIndices[0];
    if (firstPropertiesIndex + 1 < parts.length) {
      const fallbackProp = parts[firstPropertiesIndex + 1];
      console.log('Using fallback property:', fallbackProp, 'from first properties section');
      return fallbackProp;
    }
    
    return '';
  };

  const highlightTargetObject = (lines: string[], propName: string, change: DetectedChange, map: { [key: number]: DetectedChange }) => {
    let objectStart = -1;
    let objectEnd = -1;
    
    lines.forEach((line, idx) => {
      if (line.includes(`"${propName}"`) && line.includes(':') && objectStart === -1) {
        objectStart = idx;
        console.log(`Found object start for "${propName}" at line ${idx + 1}:`, line.trim());
      }
    });
    
    if (objectStart === -1) {
      console.log(`Could not find object start for property "${propName}"`);
      return;
    }
    
    const startLine = lines[objectStart];
    const isObject = startLine.includes('{') || 
                    (objectStart + 1 < lines.length && lines[objectStart + 1].trim().startsWith('{'));
    
    if (!isObject) {
      console.log(`Property "${propName}" is not an object, highlighting single line`);
      map[objectStart + 1] = change;
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
          console.log(`Found object end for "${propName}" at line ${i + 1}:`, line.trim());
          break;
        }
      }
    }
    
    if (objectEnd !== -1) {
      const linesToHighlight = objectEnd - objectStart + 1;
      if (linesToHighlight > 8) {
        console.log(`Object "${propName}" is too large (${linesToHighlight} lines), highlighting first 3 lines only`);
        for (let i = objectStart; i < objectStart + 3; i++) {
          map[i + 1] = change;
        }
      } else {
        for (let i = objectStart; i <= objectEnd; i++) {
          map[i + 1] = change;
        }
        console.log(`Highlighted object "${propName}" from line ${objectStart + 1} to ${objectEnd + 1}`);
      }
    } else {
      console.log(`Could not find object end for "${propName}", highlighting single line`);
      map[objectStart + 1] = change;
    }
  };

  const highlightPropertyLine = (lines: string[], propName: string, change: DetectedChange, map: { [key: number]: DetectedChange }) => {
    lines.forEach((line, idx) => {
      if (line.includes(`"${propName}"`)) {
        map[idx + 1] = change;
        console.log(`Highlighted single line ${idx + 1} for property "${propName}":`, line.trim())
      }
    });
  };

  function primaryTypeOf(change: DetectedChange): 'addition' | 'removal' | 'rename' | 'type-change' {
    const arr = Array.isArray(change.type) ? change.type : [change.type]
    const sarr = arr.map(t => (typeof t === 'string' ? t : String(t))).map(s => s.toLowerCase())
    if (sarr.includes('addition')) return 'addition'
    if (sarr.includes('removal')) return 'removal'
    if (sarr.includes('rename')) return 'rename'
    return 'type-change'
  }

  function markSelected(as: 'tp' | 'fp') {
    if (!selectedChangeId) return
    setLabels(prev => ({ ...prev, [selectedChangeId]: as }))
  }

  async function computeAndStoreEvaluation() {
    if (!changes) return
    setEvalError(null)
    setEvalResult(null)
    setEvalSaving(true)
    try {
      const predicted = changes.changes.map(c => ({
        id: c.changeId,
        type: primaryTypeOf(c),
        path: c.path || '',
      }))
      const gold: Array<{ id: string; type: 'addition' | 'removal' | 'rename' | 'type-change'; path: string }> = []
      for (const c of changes.changes) {
        if (labels[c.changeId] === 'tp') {
          gold.push({ id: c.changeId, type: primaryTypeOf(c), path: c.path || '' })
        }
      }
      const pushFn = (type: 'addition' | 'removal' | 'rename' | 'type-change', count: number) => {
        for (let i = 0; i < Math.max(0, count | 0); i++) {
          gold.push({ id: `fn-${type}-${i + 1}`, type, path: `$.fn.${type}.${i + 1}` })
        }
      }
      pushFn('addition', fnAddition)
      pushFn('removal', fnRemoval)
      pushFn('rename', fnRename)
      pushFn('type-change', fnTypeChange)
      const resp = await api.submitEvaluationDiff({ runId, gold, predicted } as any)
      if (resp.error) {
        setEvalError(resp.error)
      } else {
        setEvalResult(resp.data as DiffQualityResultDto)
      }
    } catch (e: any) {
      setEvalError(e?.message || 'Failed to compute evaluation')
    } finally {
      setEvalSaving(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-zinc-800 shadow rounded-lg p-6">
            <div className="text-red-200">{error}</div>
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

    console.log('Getting style for line', lineNumber, 'change:', change)

    const changeTypes = Array.isArray(change.type) ? change.type : [change.type];
    
    const hasAddition = changeTypes.some(type => 
      type === ChangeType.ADDITION || (typeof type === 'string' && type === 'addition')
    );
    const hasRemoval = changeTypes.some(type => 
      type === ChangeType.REMOVAL || (typeof type === 'string' && type === 'removal')
    );
    const hasRename = changeTypes.some(type => 
      type === ChangeType.RENAME || (typeof type === 'string' && type === 'rename')
    );
    const hasTypeChange = changeTypes.some(type => 
      type === ChangeType.TYPE_CHANGE || (typeof type === 'string' && type === 'type-change')
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

  return (
    <div className="flex flex-col h-screen bg-zinc-900">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg text-white">Dataspecer</span>
          <span className="text-lg text-gray-300">Adjuster</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/evaluation/diff')}
            className="px-4 py-2 rounded text-white font-medium"
            style={{ background: '#2563EB' }}
          >
            Evaluate Diff
          </button>
          <button
            onClick={() => {
              const d = changes?.dialogId ? `?dialogId=${encodeURIComponent(changes.dialogId)}` : '';
              router.push(`/evaluation/ux${d}`);
            }}
            className="px-4 py-2 rounded text-white font-medium"
            style={{ background: '#16A34A' }}
          >
            UX Survey
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded text-white font-medium"
            style={{ background: '#636E83' }}
          >
            Reimport
          </button>
        </div>
      </nav>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-zinc-800 flex flex-col min-h-0">
          <div className="p-6 pb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-100">JSON Schema</h2>
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
              {schema}
            </SyntaxHighlighter>
          </div>
          <div className="p-6 pt-4 flex-shrink-0">
            <div className="text-sm text-gray-400">
              <span>Legend: </span>
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(5, 150, 105, 0.4)', color: '#FFFFFF' }}>Addition</span>{' '}
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(220, 38, 38, 0.4)', color: '#FFFFFF' }}>Removal</span>{' '}
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.4)', color: '#FFFFFF' }}>Rename/Type Change</span>
            </div>
          </div>
        </div>

        <div className="w-1/2 flex flex-col min-h-0">
          <div className="p-6 pb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-100">Change Details</h2>
          </div>
          <div className="flex-1 overflow-auto px-6 min-h-0">
            {selectedChange ? (
              <div>
                <div className="mb-2 font-semibold text-gray-200">
                  Type: {selectedChange.type.join(', ')}
                </div>
                <div className="mb-2 text-gray-200">Path: {selectedChange.path}</div>
                <div className="mb-2 text-gray-200">Description: {selectedChange.description}</div>
                <div className="mb-2 text-gray-200">Acceptable: {selectedChange.isAcceptable ? 'Yes' : 'No'}</div>
                {selectedChange.groupId && (
                  <div className="mb-2 text-gray-200">Group ID: {selectedChange.groupId}</div>
                )}
                <div className="mb-3">
                  <div className="text-sm text-gray-300 mb-1">Mark this detection</div>
                  <div className="flex gap-2">
                    <button onClick={() => markSelected('tp')} className={`px-3 py-1 rounded ${labels[selectedChange.changeId] === 'tp' ? 'bg-green-600 text-white' : 'bg-zinc-700 text-gray-200 hover:bg-zinc-600'}`}>TP</button>
                    <button onClick={() => markSelected('fp')} className={`px-3 py-1 rounded ${labels[selectedChange.changeId] === 'fp' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-gray-200 hover:bg-zinc-600'}`}>FP</button>
                  </div>
                </div>
                {selectedSuggestion && (
                  <>
                    <div className="mb-2 text-gray-200">Suggestion: {selectedSuggestion.suggestion}</div>
                    {selectedSuggestion.rationale && (
                      <div className="mb-2 text-gray-200">Rationale: {selectedSuggestion.rationale}</div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-gray-400">Select a highlighted change in the schema to see details here.</div>
            )}
          </div>
          <div className="p-6 pt-4 flex-shrink-0">
            <div className="mb-4 bg-zinc-800 border border-zinc-700 rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-300">Run ID</div>
                <div className="text-xs text-gray-500">{runId}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">FN (addition)</label>
                  <input type="number" min={0} value={fnAddition} onChange={e => setFnAddition(Number(e.target.value))} className="w-full bg-zinc-700 rounded px-2 py-1 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">FN (removal)</label>
                  <input type="number" min={0} value={fnRemoval} onChange={e => setFnRemoval(Number(e.target.value))} className="w-full bg-zinc-700 rounded px-2 py-1 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">FN (rename)</label>
                  <input type="number" min={0} value={fnRename} onChange={e => setFnRename(Number(e.target.value))} className="w-full bg-zinc-700 rounded px-2 py-1 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">FN (type-change)</label>
                  <input type="number" min={0} value={fnTypeChange} onChange={e => setFnTypeChange(Number(e.target.value))} className="w-full bg-zinc-700 rounded px-2 py-1 text-sm outline-none" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button onClick={computeAndStoreEvaluation} disabled={evalSaving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{evalSaving ? 'Saving...' : 'Compute & Store'}</button>
                {evalError && <span className="text-red-400 text-sm">{evalError}</span>}
                {evalResult && (
                  <span className="text-green-400 text-sm">
                    Saved. Micro F1: {evalResult.microAveraged.f1.toFixed(3)}
                  </span>
                )}
              </div>
            </div>
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
