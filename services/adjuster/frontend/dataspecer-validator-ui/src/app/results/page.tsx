'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DetectedChangesDto, SuggestionsDto, DetectedChange, ChangeType } from '../services/api'
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
      const parsedChanges = JSON.parse(storedChanges)
      const parsedSuggestions = JSON.parse(storedSuggestions)
      
      // Debug logging
      console.log('Parsed changes:', parsedChanges)
      console.log('Parsed suggestions:', parsedSuggestions)
      console.log('Schema length:', storedSchema.length)
      
      setChanges(parsedChanges)
      setSuggestions(parsedSuggestions)
      setSchema(storedSchema)
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
      
      // Parse the JSONPath to find the most specific property to highlight
      const targetProperty = extractTargetProperty(change.path);
      console.log('Target property to highlight:', targetProperty, 'from path:', change.path)
      
      if (targetProperty) {
        // Check if this is a structural change that needs object highlighting
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

  // Extract the most specific property name that should be highlighted
  const extractTargetProperty = (path: string): string => {
    // For path like $.properties.zahrnuje_jako_člena.items.properties.je_členem_svazku_obcí.properties.ič_obce.items.type
    // We want to highlight 'ič_obce' (the last meaningful property before the final attribute)
    
    const parts = path.split('.');
    console.log('Path parts:', parts);
    
    // Find all 'properties' indices
    const propertiesIndices = parts
      .map((part, index) => part === 'properties' ? index : -1)
      .filter(index => index !== -1);
    
    console.log('Properties indices:', propertiesIndices);
    
    if (propertiesIndices.length === 0) return '';
    
    // Get the last 'properties' section - this is usually where the actual change is
    const lastPropertiesIndex = propertiesIndices[propertiesIndices.length - 1];
    
    // The property name should be right after the last 'properties'
    if (lastPropertiesIndex + 1 < parts.length) {
      const targetProp = parts[lastPropertiesIndex + 1];
      console.log('Found target property:', targetProp, 'at last properties section');
      return targetProp;
    }
    
    // Fallback: if we can't find the last properties section, use the first one
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
    
    // Find the start of the property definition
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
    
    // Check if this property's value is an object (contains opening brace)
    const startLine = lines[objectStart];
    const isObject = startLine.includes('{') || 
                    (objectStart + 1 < lines.length && lines[objectStart + 1].trim().startsWith('{'));
    
    if (!isObject) {
      // Not an object, just highlight the single line
      console.log(`Property "${propName}" is not an object, highlighting single line`);
      map[objectStart + 1] = change;
      return;
    }
    
    // For nested properties, use a more conservative approach - limit highlighting to smaller objects
    let braceCount = 0;
    let foundFirstBrace = false;
    let maxLinesToCheck = 10; // More conservative limit for nested properties
    let linesChecked = 0;
    
    for (let i = objectStart; i < lines.length && linesChecked < maxLinesToCheck; i++) {
      const line = lines[i];
      linesChecked++;
      
      // Count opening and closing braces
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      if (openBraces > 0) {
        foundFirstBrace = true;
      }
      
      if (foundFirstBrace) {
        braceCount += openBraces - closeBraces;
        
        // If we've closed all braces, this is the end of the object
        if (braceCount === 0) {
          objectEnd = i;
          console.log(`Found object end for "${propName}" at line ${i + 1}:`, line.trim());
          break;
        }
      }
    }
    
    // Highlight the object, but with stricter limits for nested properties
    if (objectEnd !== -1) {
      const linesToHighlight = objectEnd - objectStart + 1;
      if (linesToHighlight > 8) {
        // For nested properties, be even more conservative
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
      // Fallback to highlighting just the property line
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

    console.log('Getting style for line', lineNumber, 'change:', change)

    // Check if the change has any of the types - handle both string and enum formats
    const changeTypes = Array.isArray(change.type) ? change.type : [change.type];
    
    // Convert string types to check against enum values
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
    
    // Base style for full-width highlighting
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
        backgroundColor: 'rgba(5, 150, 105, 0.25)', // Transparent green
        borderLeft: '4px solid rgba(5, 150, 105, 0.6)'
      };
    }

    if (hasRemoval) {
      return { 
        ...baseStyle,
        backgroundColor: 'rgba(220, 38, 38, 0.25)', // Transparent red
        borderLeft: '4px solid rgba(220, 38, 38, 0.6)'
      };
    }

    if (hasRename || hasTypeChange) {
      return { 
        ...baseStyle,
        backgroundColor: 'rgba(37, 99, 235, 0.25)', // Transparent blue
        borderLeft: '4px solid rgba(37, 99, 235, 0.6)'
      };
    }

    // Default highlight for any other changes
    return { 
      ...baseStyle,
      backgroundColor: 'rgba(245, 158, 11, 0.25)', // Transparent amber
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
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded text-white font-medium"
          style={{ background: '#636E83' }}
        >
          Reimport
        </button>
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
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(5, 150, 105, 0.4)', color: '#065f46' }}>Addition</span>{' '}
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(220, 38, 38, 0.4)', color: '#7f1d1d' }}>Removal</span>{' '}
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.4)', color: '#1e3a8a' }}>Rename/Type Change</span>
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
