'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '../services/api'

interface FileState {
  content: string | null;
  name: string | null;
}

export default function UploadForm() {
  const [oldApi, setOldApi] = useState<FileState>({ content: null, name: null });
  const [newApi, setNewApi] = useState<FileState>({ content: null, name: null });
  const [psm, setPsm] = useState<FileState>({ content: null, name: null });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if PSM IRI is provided via query parameter
  const psmIri = searchParams.get('data-psm-schema');
  const dataSpecificationIri = searchParams.get('data-specification');
  const isIriMode = !!psmIri && !!dataSpecificationIri;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const dialogId = Date.now().toString();
      
      let changesResponse;
      
      if (isIriMode) {
        // Use hybrid approach - PSM via IRI, old and new schemas manually uploaded
        if (!oldApi.content || !newApi.content) {
          setError('Please upload both old and new JSON schemas.');
          return;
        }
        
        if (!psmIri || !dataSpecificationIri) {
          setError('Missing PSM schema IRI or data specification IRI in URL parameters.');
          return;
        }
        
        // Use detectChangesHybrid endpoint - PSM via IRI, schemas manually uploaded
        changesResponse = await api.detectChangesHybrid(psmIri, oldApi.content, newApi.content, dialogId);
      } else {
        // Use traditional file upload approach
        if (!oldApi.content || !newApi.content || !psm.content) {
          setError('Please upload all required files.');
          return;
        }
        
        changesResponse = await api.detectChanges(
          oldApi.content,
          newApi.content,
          psm.content,
          dialogId
        );
      }

      if (changesResponse.error) {
        throw new Error(changesResponse.error);
      }

      if (!changesResponse.data) {
        throw new Error('No changes detected');
      }

      console.log('Changes response data:', changesResponse.data);

      const suggestionsResponse = await api.getSuggestions(
        changesResponse.data,
        psm.content || '' // PSM content handled by backend for IRI mode
      );

      if (suggestionsResponse.error) {
        throw new Error(suggestionsResponse.error);
      }

      console.log('Suggestions response data:', suggestionsResponse.data);

      sessionStorage.setItem('detectedChanges', JSON.stringify(changesResponse.data));
      sessionStorage.setItem('suggestions', JSON.stringify(suggestionsResponse.data));
      sessionStorage.setItem('originalSchema', newApi.content || '');
      
      console.log('Stored in sessionStorage:', {
        detectedChanges: JSON.stringify(changesResponse.data),
        suggestions: JSON.stringify(suggestionsResponse.data),
        originalSchema: newApi.content?.substring(0, 100) + '...'
      });
      
      router.push('/results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Old JSON Schema
        </label>
        <input
          type="file"
          accept=".json"
          onChange={(e) => handleFileChange(e, setOldApi)}
          className="block w-full text-sm text-gray-200 file:bg-zinc-700 file:border-none file:px-4 file:py-2 file:rounded file:text-white hover:file:bg-zinc-600"
        />
        {oldApi.name && (
          <p className="text-sm text-gray-400 mt-1">Selected: {oldApi.name}</p>
        )}
      </div>

      {!isIriMode && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            PSM Artifact
          </label>
          <input
            type="file"
            accept=".json"
            onChange={(e) => handleFileChange(e, setPsm)}
            className="block w-full text-sm text-gray-200 file:bg-zinc-700 file:border-none file:px-4 file:py-2 file:rounded file:text-white hover:file:bg-zinc-600"
          />
          {psm.name && (
            <p className="text-sm text-gray-400 mt-1">Selected: {psm.name}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          New JSON Schema
        </label>
        <input
          type="file"
          accept=".json"
          onChange={(e) => handleFileChange(e, setNewApi)}
          className="block w-full text-sm text-gray-200 file:bg-zinc-700 file:border-none file:px-4 file:py-2 file:rounded file:text-white hover:file:bg-zinc-600"
        />
        {newApi.name && (
          <p className="text-sm text-gray-400 mt-1">Selected: {newApi.name}</p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isLoading || (!oldApi.content || !newApi.content || (!isIriMode && !psm.content))}
        className="w-full text-white px-4 py-2 rounded transition disabled:cursor-not-allowed"
        style={{ background: isLoading ? '#636E83' : '#636E83' }}
      >
        {isLoading ? 'Processing...' : 'Analyze Changes'}
      </button>
    </form>
  );
}
