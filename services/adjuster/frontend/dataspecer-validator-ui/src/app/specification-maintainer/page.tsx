'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [oldSchema, setOldSchema] = useState<FileState>({ content: null, name: null });
  const [newSchema, setNewSchema] = useState<FileState>({ content: null, name: null });
  const [psmFile, setPsmFile] = useState<FileState>({ content: null, name: null });
  

  const [changes, setChanges] = useState<SchemaChangeDto[]>([])
  
  const [specificationDecisions, setSpecificationDecisions] = useState<Map<string, ChangeDecision>>(new Map())
  const [developerDecisions, setDeveloperDecisions] = useState<Map<string, ChangeDecision>>(new Map())
  
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)
  const [highlightMap, setHighlightMap] = useState<{ [key: number]: DetectedChange }>({})
  const [loading, setLoading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingPsm, setIsLoadingPsm] = useState(false)
  const [isLoadingOldSchema, setIsLoadingOldSchema] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  
  const [specCommentInputs, setSpecCommentInputs] = useState<Map<string, string>>(new Map())
  const [devCommentInputs, setDevCommentInputs] = useState<Map<string, string>>(new Map())
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatSelectedChanges, setChatSelectedChanges] = useState<string[]>([])
  const [useAutomatic, setUseAutomatic] = useState(false);

  const [isEditingChange, setIsEditingChange] = useState(false);
  const [editingChange, setEditingChange] = useState<SchemaChangeDto | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [regenerationFeedback, setRegenerationFeedback] = useState<Map<string, string>>(new Map())
  const [isRegeneratingMap, setIsRegeneratingMap] = useState<Map<string, boolean>>(new Map())
  const [regenerationErrors, setRegenerationErrors] = useState<Map<string, string>>(new Map())
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const psmIri = searchParams.get('data-psm-schema')
  const dataSpecificationIri = searchParams.get('data-specification')
  const isIriMode = !!psmIri && !!dataSpecificationIri
  
  console.log('Specification Maintainer Debug:', {
    psmIri,
    dataSpecificationIri, 
    isIriMode,
    useAutomatic,
    urlParams: Object.fromEntries(searchParams.entries())
  })

  useEffect(() => {
    const autoLoaded = !!oldSchema.name && oldSchema.name.includes('(Auto-loaded via DSV)')
    setUseAutomatic(isIriMode && autoLoaded)
  }, [isIriMode, oldSchema.name])

  useEffect(() => {
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

  useEffect(() => {
    console.log('Old JSON Schema auto-load check:', { 
      dataSpecificationIri, 
      isIriMode, 
      hasOldSchema: !!oldSchema.content 
    });
    
    if (dataSpecificationIri && isIriMode && !oldSchema.content) {
      console.log('Starting auto-load of Old JSON Schema via DSV...');
      setIsLoadingOldSchema(true)
      api.fetchJsonSchemaFromDsv(dataSpecificationIri)
        .then(response => {
          if (response.data) {
            setOldSchema({
              content: response.data.content,
              name: response.data.name + ' (Auto-loaded via DSV)'
            })
          } else if (response.error) {
            setError(`Failed to load old JSON schema via DSV: ${response.error}`)
          }
        })
        .catch(err => {
          setError(`Failed to load old JSON schema via DSV: ${err.message}`)
        })
        .finally(() => {
          setIsLoadingOldSchema(false)
        })
    }
  }, [dataSpecificationIri, isIriMode, oldSchema.content])

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

  const loadChanges = useCallback(async () => {
    if (useAutomatic && isIriMode) {
      if (!newSchema.content || !psmFile.content) return
    } else {
      if (!oldSchema.content || !newSchema.content || !psmFile.content) return
    }
    
    setLoading(true)
    
    try {
      const newAnalysisId = Date.now().toString()
      
      let changesResponse;
      
      const oldIsAuto = !!oldSchema.name && oldSchema.name.includes('(Auto-loaded via DSV)')

      if (isIriMode && dataSpecificationIri && psmIri && oldIsAuto) {
        console.log('Using automatic DSV approach with:', { dataSpecificationIri, psmIri })
        changesResponse = await api.detectChangesAutomatic(
          dataSpecificationIri,
          psmIri,
          newSchema.content,
          newAnalysisId
        )
      } else if (isIriMode && oldSchema.content && !oldIsAuto) {
        changesResponse = await api.detectChanges(
          oldSchema.content,
          newSchema.content,
          '',
          newAnalysisId,
          psmIri
        )
      } else {
        changesResponse = await api.detectChanges(
          oldSchema.content!,
          newSchema.content,
          psmFile.content!,
          newAnalysisId
        )
      }

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
      
      setIsAutoSaving(true)
      try {
        await api.storeAnalysis({
          analysisId: newAnalysisId,
          oldSchemaName: oldSchema.name || 'old-schema.json',
          newSchemaName: newSchema.name || 'new-schema.json', 
          psmFileName: psmFile.name || 'psm.json',
          changes: transformedChanges,
          schema: newSchema.content,
          decisions: [] 
        })
        setLastSaved(new Date())
        console.log('Initial analysis auto-saved with ID:', newAnalysisId)
      } catch (saveError) {
        console.error('Failed to auto-save initial analysis:', saveError)
      } finally {
        setIsAutoSaving(false)
      }
    } catch (error) {
      console.error('Failed to load changes:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }, [oldSchema.content, newSchema.content, psmFile.content, useAutomatic, isIriMode, dataSpecificationIri, psmIri])

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

  const findNextUnprocessedSpecChange = useCallback(() => {
    const currentIndex = changes.findIndex(change => change.id === selectedChangeId)
    const nextChanges = changes.slice(currentIndex + 1)
    const remainingChanges = changes.slice(0, currentIndex)
    
    for (const change of nextChanges) {
      if (!specificationDecisions.has(change.id)) {
        return change.id
      }
    }
    
    for (const change of remainingChanges) {
      if (!specificationDecisions.has(change.id)) {
        return change.id
      }
    }
    
    return null
  }, [changes, selectedChangeId, specificationDecisions])

  const scrollToChange = useCallback((changeId: string) => {
    const changeItem = changes.find(c => c.id === changeId)
    if (changeItem) {
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
    
    const changeElement = document.querySelector(`[data-change-id="${changeId}"]`)
    if (changeElement) {
      changeElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
    }
  }, [changes, highlightMap])

  const handleSpecificationDecision = useCallback(async (changeId: string, decision: 'accept' | 'reject', comment?: string) => {
    const newDecisions = new Map(specificationDecisions)
    const finalComment = comment || specCommentInputs.get(changeId) || undefined
    newDecisions.set(changeId, { changeId, decision, comment: finalComment })
    setSpecificationDecisions(newDecisions)
    
    const newCommentInputs = new Map(specCommentInputs)
    newCommentInputs.delete(changeId)
    setSpecCommentInputs(newCommentInputs)
    
    if (analysisId && newSchema.content) {
      setIsAutoSaving(true)
      try {
        const devReviewFromComments = Array.from(devCommentInputs.entries())
          .filter(([_, val]) => !!val && val.trim().length > 0)
          .map(([changeId, comment]) => ({ changeId, decision: 'developer' as const, comment }))

        const devReviewFromDecisions = Array.from(developerDecisions.values())
          .map(d => ({
            changeId: d.changeId,
            decision: 'developer' as const,
            comment: d.comment || `Developer review: ${d.decision}`,
          }))

        const devMergedMap = new Map<string, { changeId: string; decision: 'developer'; comment?: string }>()
        for (const it of [...devReviewFromDecisions, ...devReviewFromComments]) {
          devMergedMap.set(it.changeId, it)
        }

        const allDecisions = [
          ...Array.from(newDecisions.values()),
          ...Array.from(devMergedMap.values()),
        ]

        await api.storeAnalysis({
          analysisId,
          oldSchemaName: oldSchema.name || 'old-schema.json',
          newSchemaName: newSchema.name || 'new-schema.json', 
          psmFileName: psmFile.name || 'psm.json',
          changes,
          schema: newSchema.content,
          decisions: allDecisions
        })
        setLastSaved(new Date())
        console.log('Analysis auto-saved with updated decisions')
      } catch (error) {
        console.error('Failed to auto-save analysis:', error)
      } finally {
        setIsAutoSaving(false)
      }
    }
    
    const nextChangeId = findNextUnprocessedSpecChange()
    if (nextChangeId) {
      setTimeout(() => {
        setSelectedChangeId(nextChangeId)
        scrollToChange(nextChangeId)
      }, 300) 
    }
  }, [specificationDecisions, specCommentInputs, findNextUnprocessedSpecChange, scrollToChange, setSelectedChangeId, setSpecCommentInputs, analysisId, newSchema.content, oldSchema.name, newSchema.name, psmFile.name, changes, setIsAutoSaving, setLastSaved])

  const handleDeveloperDecision = useCallback((changeId: string, decision: 'accept' | 'reject', comment?: string) => {
    const newDecisions = new Map(developerDecisions)
    const finalComment = comment || devCommentInputs.get(changeId) || undefined
    newDecisions.set(changeId, { changeId, decision, comment: finalComment })
    setDeveloperDecisions(newDecisions)
    
    const newCommentInputs = new Map(devCommentInputs)
    newCommentInputs.delete(changeId)
    setDevCommentInputs(newCommentInputs)

    if (analysisId && newSchema.content) {
      (async () => {
        try {
          const specDecisions = Array.from(specificationDecisions.values())

          const devFromDecisions = Array.from(newDecisions.values()).map(d => ({
            changeId: d.changeId,
            decision: 'developer' as const,
            comment: d.comment || `Developer review: ${d.decision}`,
          }))

          const devFromComments = Array.from(newCommentInputs.entries())
            .filter(([_, val]) => !!val && val.trim().length > 0)
            .map(([id, cmt]) => ({ changeId: id, decision: 'developer' as const, comment: cmt }))

          const devMerged = new Map<string, { changeId: string; decision: 'developer'; comment?: string }>()
          for (const it of [...devFromComments, ...devFromDecisions]) {
            devMerged.set(it.changeId, it)
          }

          const allDecisions = [...specDecisions, ...Array.from(devMerged.values())]

          await api.storeAnalysis({
            analysisId: analysisId as string,
            oldSchemaName: oldSchema.name || 'old-schema.json',
            newSchemaName: newSchema.name || 'new-schema.json',
            psmFileName: psmFile.name || 'psm.json',
            changes,
            schema: newSchema.content || '',
            decisions: allDecisions,
          })
        } catch (e) {
          console.error('Failed to auto-save developer review:', e)
        }
      })()
    }
  }, [developerDecisions, devCommentInputs, setDeveloperDecisions, setDevCommentInputs, analysisId, newSchema.content, specificationDecisions, oldSchema.name, newSchema.name, psmFile.name, changes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
            handleSpecificationDecision(selectedChangeId, 'accept')
          }
          break
        case '2':
          e.preventDefault()
          if (selectedChangeId) {
            handleSpecificationDecision(selectedChangeId, 'reject')
          }
          break
        case '3':
          e.preventDefault()
          if (selectedChangeId) {
            handleDeveloperDecision(selectedChangeId, 'accept')
          }
          break
        case 'n':
          e.preventDefault()
          const nextUnprocessed = findNextUnprocessedSpecChange()
          if (nextUnprocessed) {
            setSelectedChangeId(nextUnprocessed)
            scrollToChange(nextUnprocessed)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedChangeId, changes, specificationDecisions, findNextUnprocessedSpecChange, handleSpecificationDecision, handleDeveloperDecision, scrollToChange])

  useEffect(() => {
    const handleEditKeyDown = (event: KeyboardEvent) => {
      if (isEditingChange) {
        if (event.ctrlKey && event.key === 's') {
          event.preventDefault()
          saveEditingChange()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          if (hasUnsavedChanges) {
            if (confirm('You have unsaved changes. Do you want to discard them?')) {
              cancelEditingChange()
            }
          } else {
            cancelEditingChange()
          }
        }
      }
    }

    document.addEventListener('keydown', handleEditKeyDown)
    return () => document.removeEventListener('keydown', handleEditKeyDown)
  }, [isEditingChange, hasUnsavedChanges])

  const updateSpecComment = (changeId: string, comment: string) => {
    const newCommentInputs = new Map(specCommentInputs)
    newCommentInputs.set(changeId, comment)
    setSpecCommentInputs(newCommentInputs)
  }

  const updateDevComment = (changeId: string, comment: string) => {
    const newCommentInputs = new Map(devCommentInputs)
    newCommentInputs.set(changeId, comment)
    setDevCommentInputs(newCommentInputs)
  }

  const startEditingChange = (change: SchemaChangeDto) => {
    if (isEditingChange && editingChange && editingChange.id !== change.id) {
      if (confirm('You have unsaved changes. Do you want to discard them?')) {
        cancelEditingChange();
      } else {
        return; 
      }
    }
    
    setEditingChange({ ...change });
    setIsEditingChange(true);
    setHasUnsavedChanges(false);
  };

  const cancelEditingChange = () => {
    setIsEditingChange(false);
    setEditingChange(null);
    setHasUnsavedChanges(false);
  };

  const saveEditingChange = () => {
    if (!editingChange) return;
    
    setChanges(prevChanges => 
      prevChanges.map(change => 
        change.id === editingChange.id ? editingChange : change
      )
    );

    setIsEditingChange(false);
    setEditingChange(null);
    setHasUnsavedChanges(false);
  };

  const updateEditingChange = (field: keyof SchemaChangeDto, value: any) => {
    if (!editingChange) return;
    
    setEditingChange(prev => {
      const updated = {
        ...prev!,
        [field]: value
      };
      
      if (field === 'isAcceptable') {
        updated.isProblematic = !value;
      }
      
      return updated;
    });
    
    setHasUnsavedChanges(true);
  };

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

  const acceptedSpecChanges = Array.from(specificationDecisions.values()).filter(d => d.decision === 'accept')
  const rejectedSpecChanges = Array.from(specificationDecisions.values()).filter(d => d.decision === 'reject')
  const acceptedDevChanges = Array.from(developerDecisions.values()).filter(d => d.decision === 'accept')
  const rejectedDevChanges = Array.from(developerDecisions.values()).filter(d => d.decision === 'reject')

  const handleShare = async () => {
    if (!analysisId || changes.length === 0 || !newSchema.content) return

    setIsSharing(true)
    try {

      const devReviewFromComments = Array.from(devCommentInputs.entries())
        .filter(([_, val]) => !!val && val.trim().length > 0)
        .map(([changeId, comment]) => ({ changeId, decision: 'developer' as const, comment }))

      const devReviewFromDecisions = Array.from(developerDecisions.values())
        .map(d => ({
          changeId: d.changeId,
          decision: 'developer' as const,
          comment: d.comment || `Developer review: ${d.decision}`,
        }))

      const devMergedMap = new Map<string, { changeId: string; decision: 'developer'; comment?: string }>()
      for (const it of [...devReviewFromDecisions, ...devReviewFromComments]) {
        devMergedMap.set(it.changeId, it)
      }

      const allDecisions = [
        ...Array.from(specificationDecisions.values()),
        ...Array.from(devMergedMap.values()),
      ]

      const storeResponse = await api.storeAnalysis({
        analysisId,
        oldSchemaName: oldSchema.name || 'old-schema.json',
        newSchemaName: newSchema.name || 'new-schema.json', 
        psmFileName: psmFile.name || 'psm.json',
        changes,
        schema: newSchema.content,
        decisions: allDecisions
      })

      if (storeResponse.error) {
        throw new Error(storeResponse.error)
      }

      if (storeResponse.data) {
        console.log('Store response data:', storeResponse.data)
        
        const shareUrl = storeResponse.data.shareUrl.startsWith('http') 
          ? storeResponse.data.shareUrl 
          : `${window.location.origin}/shared/${storeResponse.data.shareUrl}`
        
        console.log('Attempting to copy to clipboard:', shareUrl)
        
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(shareUrl)
            console.log('Successfully copied to clipboard using Clipboard API')
          } else {
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
    setSpecificationDecisions(new Map())
    setDeveloperDecisions(new Map())
    setSpecCommentInputs(new Map())
    setDevCommentInputs(new Map())
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
              <p className="text-gray-400">You have been assigned to the project in Dataspecer to check the changes You’ve made to your data specification. Please, provide new JSON Schema of your datat definition to proceed.</p>

            </div>

          

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Old JSON Schema *
                  {isLoadingOldSchema && <span className="text-blue-400 ml-2">(Loading via DSV...)</span>}
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => handleFileChange(e, setOldSchema)}
                  disabled={isLoadingOldSchema}
                  className="block w-full text-sm text-gray-200 file:bg-zinc-700 file:border-none file:px-4 file:py-2 file:rounded file:text-white hover:file:bg-zinc-600 disabled:opacity-50"
                />
                {oldSchema.name && (
                  <p className="text-sm text-green-200 mt-1">
                    ✓ {oldSchema.name}
                    {oldSchema.name.includes('Auto-loaded') && <span className="text-blue-400 ml-2">(Via DSV)</span>}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New JSON Schema *</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => handleFileChange(e, setNewSchema)}
                  className="block w-full text-sm text-gray-200 file:bg-zinc-700 file:border-none file:px-4 file:py-2 file:rounded file:text-white hover:file:bg-zinc-600"
                />
                {newSchema.name && <p className="text-sm text-green-200 mt-1">✓ {newSchema.name}</p>}
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
                  <p className="text-sm text-green-200 mt-1">
                    ✓ {psmFile.name}
                    {psmFromDataspecer && <span className="text-blue-200 ml-2">(Auto-loaded)</span>}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={loadChanges}
                disabled={loading || isLoadingPsm || isLoadingOldSchema || (
                  useAutomatic && isIriMode ? 
                    (!newSchema.content || !psmFile.content) :
                    (!oldSchema.content || !newSchema.content || !psmFile.content)
                )}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-lg font-medium"
              >
                {loading ? 'Analyzing Changes...' : 'Analyze Changes'}
              </button>
            </div>

            {error && (
              <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-4">
                <p className="text-red-200">{error}</p>
              </div>
            )}
                  </div>
      </div>

      <LlmChat
        changes={changes}
        selectedChangeIds={chatSelectedChanges}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
      )
}

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
              <div className="text-sm text-green-200">
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
            onClick={() => router.push('/accepted-changes')}
            className="px-4 py-2 text-white rounded transition-colors"
            style={{ background: '#636E83' }}
          >
            View Accepted Changes
          </button>
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="px-4 py-2 text-white rounded disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            style={{ background: '#636E83' }}
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
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(5, 150, 105, 0.4)', color: '#FFFFFF' }}>Addition</span>{' '}
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(220, 38, 38, 0.4)', color: '#FFFFFF' }}>Removal</span>{' '}
              <span className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.4)', color: '#FFFFFF' }}>Rename/Type Change</span>
                                     </div>
                       </div>
                       
                       <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-zinc-700">
                         💡 Tip: Use <kbd className="px-1 py-0.5 bg-zinc-600 rounded text-xs">Ctrl+S</kbd> to save or <kbd className="px-1 py-0.5 bg-zinc-600 rounded text-xs">Esc</kbd> to cancel
                       </div>
                     </div>

        <div className="w-1/2 flex flex-col min-h-0">
          <div className="p-6 pb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-100">Change Details</h2>
            <div className="text-sm text-gray-400 mt-1 flex items-center space-x-4">
              <span>Spec: {acceptedSpecChanges.length} accepted, {rejectedSpecChanges.length} rejected • Dev: {acceptedDevChanges.length} accepted, {rejectedDevChanges.length} rejected</span>
              {isAutoSaving && (
                <span className="text-blue-400 text-xs flex items-center space-x-1">
                  <span className="animate-pulse">●</span>
                  <span>Auto-saving...</span>
                </span>
              )}
              {!isAutoSaving && lastSaved && (
                <span className="text-green-200 text-xs">
                  ✓ Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto px-6 min-h-0">
            {selectedChange ? (
              <div className="space-y-4" data-change-id={selectedChange.id}>
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-white">Change Information</h3>
                      {hasUnsavedChanges && (
                        <span className="text-xs px-2 py-1 bg-orange-600 text-white rounded">
                          Unsaved Changes
                        </span>
                      )}
                    </div>
                    {isEditingChange && editingChange?.id === selectedChange.id ? (
                      <div className="space-x-2">
                        <button
                          onClick={saveEditingChange}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditingChange}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingChange(selectedChange)}
                        className="px-3 py-1 text-white text-sm rounded transition-colors"
                        style={{ background: '#636E83' }}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditingChange && editingChange?.id === selectedChange.id ? (
                    <div className="space-y-4"> 
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Type:</label>
                        <select
                          value={editingChange.type}
                          onChange={(e) => updateEditingChange('type', e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="addition">Addition</option>
                          <option value="removal">Removal</option>
                          <option value="rename">Rename</option>
                          <option value="type-change">Type Change</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Path:</label>
                        <input
                          type="text"
                          value={editingChange.path}
                          onChange={(e) => updateEditingChange('path', e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Description:</label>
                        <textarea
                          value={editingChange.description}
                          onChange={(e) => updateEditingChange('description', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editingChange.isAcceptable}
                            onChange={(e) => updateEditingChange('isAcceptable', e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-zinc-700 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-gray-300">Is Acceptable</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Suggestion (Optional):</label>
                        <textarea
                          value={editingChange.suggestion || ''}
                          onChange={(e) => updateEditingChange('suggestion', e.target.value)}
                          rows={2}
                          placeholder="Add a suggestion for handling this change..."
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Rationale (Optional):</label>
                        <textarea
                          value={editingChange.rationale || ''}
                          onChange={(e) => updateEditingChange('rationale', e.target.value)}
                          rows={2}
                          placeholder="Add rationale for the suggestion..."
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 font-semibold text-gray-200">
                        Type: {selectedChange.type.toUpperCase()}
                      </div>
                      <div className="mb-2 text-gray-200">Path: {selectedChange.path}</div>
                      <div className="mb-2 text-gray-200">Description: {selectedChange.description}</div>
                      <div className="mb-2 text-gray-200">
                        Acceptable: {selectedChange.isAcceptable ? (
                          <span className="text-green-200">Yes ✓</span>
                        ) : (
                          <span className="text-red-200">No ⚠</span>
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
                  )}
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-4 flex items-center space-x-2">
                    <span>📋</span>
                    <span>Changes to Specification Review</span>
                  </h3>
                  
                  {(() => {
                    const decision = specificationDecisions.get(selectedChange.id);
                    const comment = specCommentInputs.get(selectedChange.id) || '';
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
                      <div className="space-y-4">
                        {decision && (
                          <div className="bg-zinc-700 rounded-lg p-3 border-l-4 border-l-blue-500">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm font-medium text-gray-300">Specification Decision:</span>
                              <span className={`px-2 py-1 text-xs rounded font-medium ${
                                decision.decision === 'accept' ? 'bg-green-600 text-white' :
                                decision.decision === 'reject' ? 'bg-red-600 text-white' :
                                'bg-yellow-600 text-white'
                              }`}>
                                {decision.decision === 'accept' ? '✓ Accepted for Spec' :
                                 decision.decision === 'reject' ? '✗ Rejected from Spec' : '⚠ Other'}
                              </span>
                            </div>
                            {decision.comment && (
                              <div className="text-sm text-gray-300 mt-2 italic">
                                "{decision.comment}"
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              💬 Specification Review Comment (Optional)
                            </label>
                            <textarea
                              value={comment}
                              onChange={(e) => updateSpecComment(selectedChange.id, e.target.value)}
                              placeholder="Explain your decision, provide additional context, or suggest alternatives..."
                              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              rows={3}
                            />
                          </div>

                          <div className="border-t border-zinc-700 pt-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-300">📝 Review Decision</span>
                              {decision && (
                                <button
                                  onClick={async () => {
                                    const newDecisions = new Map(specificationDecisions)
                                    newDecisions.delete(selectedChange.id)
                                    setSpecificationDecisions(newDecisions)
                                    const newCommentInputs = new Map(specCommentInputs)
                                    newCommentInputs.delete(selectedChange.id)
                                    setSpecCommentInputs(newCommentInputs)
                                    
                                    if (analysisId && newSchema.content) {
                                      setIsAutoSaving(true)
                                      try {
                                        const devReviewFromComments = Array.from(devCommentInputs.entries())
                                          .filter(([_, val]) => !!val && val.trim().length > 0)
                                          .map(([changeId, comment]) => ({ changeId, decision: 'developer' as const, comment }))

                                        const devReviewFromDecisions = Array.from(developerDecisions.values())
                                          .map(d => ({
                                            changeId: d.changeId,
                                            decision: 'developer' as const,
                                            comment: d.comment || `Developer review: ${d.decision}`,
                                          }))

                                        const devMergedMap = new Map<string, { changeId: string; decision: 'developer'; comment?: string }>()
                                        for (const it of [...devReviewFromDecisions, ...devReviewFromComments]) {
                                          devMergedMap.set(it.changeId, it)
                                        }

                                        const allDecisions = [
                                          ...Array.from(newDecisions.values()),
                                          ...Array.from(devMergedMap.values()),
                                        ]

                                        await api.storeAnalysis({
                                          analysisId,
                                          oldSchemaName: oldSchema.name || 'old-schema.json',
                                          newSchemaName: newSchema.name || 'new-schema.json', 
                                          psmFileName: psmFile.name || 'psm.json',
                                          changes,
                                          schema: newSchema.content,
                                          decisions: allDecisions
                                        })
                                        setLastSaved(new Date())
                                      } catch (error) {
                                        console.error('Failed to auto-save analysis after clear:', error)
                                      } finally {
                                        setIsAutoSaving(false)
                                      }
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-gray-600 bg-opacity-20 text-gray-400 hover:bg-opacity-40 rounded transition-colors"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleSpecificationDecision(selectedChange.id, 'accept')}
                                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                                  decision?.decision === 'accept'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-green-600 bg-opacity-20 text-green-200 hover:bg-opacity-40'
                                }`}
                              >
                                ✓ Accept
                              </button>
                              <button
                                onClick={() => handleSpecificationDecision(selectedChange.id, 'reject')}
                                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                                  decision?.decision === 'reject'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-red-600 bg-opacity-20 text-red-200 hover:bg-opacity-40'
                                }`}
                              >
                                ✗ Reject
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-zinc-700 pt-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <span className="text-sm font-medium text-gray-300">🤖 Improve AI Analysis</span>
                              <span className="text-xs text-gray-500">(Optional)</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                              Not satisfied with the AI analysis? Describe what should be improved to get a better description.
                            </p>
                            
                            <div className="space-y-3">
                              <textarea
                                value={feedback}
                                onChange={(e) => updateRegenerationFeedback(selectedChange.id, e.target.value)}
                                placeholder="E.g., The description is unclear, the acceptability assessment seems wrong, the suggestion is not helpful..."
                                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-xs resize-none focus:outline-none focus:border-blue-500"
                                rows={2}
                              />
                              
                              {regenerationError && (
                                <div className="text-xs text-red-200 bg-red-900 bg-opacity-20 p-2 rounded-lg">
                                  {regenerationError}
                                </div>
                              )}
                              
                              <div className="flex space-x-2">
                                <button
                                  onClick={handleRegenerate}
                                  disabled={isRegenerating || !feedback.trim()}
                                  className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                                >
                                  <span>🔄</span>
                                  <span>{isRegenerating ? 'Regenerating...' : 'Regenerate Analysis'}</span>
                                </button>
                                {feedback && (
                                  <button
                                    onClick={() => {
                                      updateRegenerationFeedback(selectedChange.id, '');
                                      setRegenerationError(selectedChange.id, null);
                                    }}
                                    className="px-3 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-4 flex items-center space-x-2">
                    <span>👨‍💻</span>
                    <span>Review for Developers</span>
                  </h3>
                  
                  {(() => {
                    const decision = developerDecisions.get(selectedChange.id);
                    const comment = devCommentInputs.get(selectedChange.id) || '';
                    const specDecision = specificationDecisions.get(selectedChange.id);
                    
                    return (
                      <div className="space-y-4">
                        {specDecision && (
                          <div className="bg-zinc-700 rounded p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm text-gray-300">Maintainer Decision:</span>
                              <span className={`px-2 py-1 text-xs rounded ${
                                specDecision.decision === 'accept' ? 'bg-green-600 text-white' :
                                specDecision.decision === 'reject' ? 'bg-red-600 text-white' :
                                'bg-yellow-600 text-white'
                              }`}>
                                {specDecision.decision === 'accept' ? '✓ Accepted' :
                                 specDecision.decision === 'reject' ? '✗ Rejected' :
                                 'Other'}
                              </span>
                            </div>
                            {specDecision.comment && (
                              <div>
                                <div className="text-xs text-gray-400 mb-1">Maintainer Comment:</div>
                                <div className="text-sm text-gray-300 bg-zinc-600 p-2 rounded">
                                  {specDecision.comment}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {decision && (
                          <div className="bg-zinc-700 rounded p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm text-gray-300">Developer Review Decision:</span>
                              <span className={`px-2 py-1 text-xs rounded ${
                                decision.decision === 'accept' ? 'bg-green-600 text-white' :
                                decision.decision === 'reject' ? 'bg-red-600 text-white' :
                                'bg-yellow-600 text-white'
                              }`}>
                                {decision.decision === 'accept' ? '✓ Accepted (Dev)' :
                                 decision.decision === 'reject' ? '✗ Rejected (Dev)' :
                                 'Other'}
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
                        
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            💬 Developer Review Comment {decision ? '(to update decision)' : '(optional)'}
                          </label>
                          <textarea
                            value={comment}
                            onChange={(e) => updateDevComment(selectedChange.id, e.target.value)}
                            placeholder="Add a comment to explain your decision..."
                            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm resize-none focus:outline-none focus:border-blue-500"
                            rows={3}
                          />
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleDeveloperDecision(selectedChange.id, 'accept')}
                            className={`px-3 py-2 text-sm rounded transition-colors ${
                              decision?.decision === 'accept'
                                ? 'bg-green-600 text-white'
                                : 'bg-green-600 bg-opacity-20 text-green-200 hover:bg-opacity-40'
                            }`}
                          >
                            ✓ Accept (Dev Review)
                          </button>
                          <button
                            onClick={() => handleDeveloperDecision(selectedChange.id, 'reject')}
                            className={`px-3 py-2 text-sm rounded transition-colors ${
                              decision?.decision === 'reject'
                                ? 'bg-red-600 text-white'
                                : 'bg-red-600 bg-opacity-20 text-red-200 hover:bg-opacity-40'
                            }`}
                          >
                            ✗ Reject (Dev Review)
                          </button>
                          {decision && (
                            <button
                              onClick={() => {
                                const newDecisions = new Map(developerDecisions)
                                newDecisions.delete(selectedChange.id)
                                setDeveloperDecisions(newDecisions)
                                const newCommentInputs = new Map(devCommentInputs)
                                newCommentInputs.delete(selectedChange.id)
                                setDevCommentInputs(newCommentInputs)
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
              <div className="text-center text-gray-400 py-8">
                <p>Select a change to view details and make review decisions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <LlmChat
        changes={changes}
        selectedChangeIds={chatSelectedChanges}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
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
  );
}