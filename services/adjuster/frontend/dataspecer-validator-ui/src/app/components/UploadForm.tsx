'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    if (!oldApi.content || !newApi.content || !psm.content) {
      setError('Please upload all required files.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dialogId = Date.now().toString();
      const changesResponse = await api.detectChanges(
        oldApi.content,
        newApi.content,
        psm.content,
        dialogId
      );

      if (changesResponse.error) {
        throw new Error(changesResponse.error);
      }

      if (!changesResponse.data) {
        throw new Error('No changes detected');
      }

      const suggestionsResponse = await api.getSuggestions(
        changesResponse.data,
        psm.content
      );

      if (suggestionsResponse.error) {
        throw new Error(suggestionsResponse.error);
      }

      sessionStorage.setItem('detectedChanges', JSON.stringify(changesResponse.data));
      sessionStorage.setItem('suggestions', JSON.stringify(suggestionsResponse.data));
      sessionStorage.setItem('originalSchema', newApi.content!);
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
          Old API Schema
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

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          New API Schema
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

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition disabled:bg-blue-800 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Processing...' : 'Analyze Changes'}
      </button>
    </form>
  );
}
