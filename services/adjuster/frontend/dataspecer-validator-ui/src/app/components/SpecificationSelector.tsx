'use client'

import { useState, useEffect } from 'react'
import { SelectedSpecification } from '../types/specification-maintainer'
import { api } from '../services/api'

interface SpecificationSelectorProps {
  onSpecificationSelected: (spec: SelectedSpecification) => void
}

export default function SpecificationSelector({ onSpecificationSelected }: SpecificationSelectorProps) {
  const [specifications, setSpecifications] = useState<SelectedSpecification[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSpec, setSelectedSpec] = useState<SelectedSpecification | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSpecifications()
  }, [])

  const loadSpecifications = async (search?: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.getSpecifications(search)
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      if (response.data) {
        setSpecifications(response.data)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load specifications')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    const timeoutId = setTimeout(() => {
      loadSpecifications(value || undefined)
    }, 300)
    
    return () => clearTimeout(timeoutId)
  }

  const filteredSpecifications = specifications.filter(spec =>
    spec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    spec.psm.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSpecificationClick = (spec: SelectedSpecification) => {
    setSelectedSpec(spec)
  }

  const handleAdjustClick = () => {
    if (selectedSpec) {
      onSpecificationSelected(selectedSpec)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading specifications from Dataspecer...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-200 mb-4">{error}</div>
        <button
          onClick={() => loadSpecifications()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Select Specification</h3>
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search specifications..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <svg
            className="absolute right-3 top-2.5 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredSpecifications.map((spec) => (
          <div
            key={spec.id}
            onClick={() => handleSpecificationClick(spec)}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedSpec?.id === spec.id
                ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                : 'border-zinc-600 bg-zinc-700 hover:border-zinc-500 hover:bg-zinc-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-white mb-1">{spec.name}</h4>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>PSM: {spec.psm.name}</p>
                  <p className="text-xs break-all">IRI: {spec.psm.iri}</p>
                </div>
              </div>
              {selectedSpec?.id === spec.id && (
                <div className="flex-shrink-0 ml-4">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredSpecifications.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-400">No specifications found matching your search.</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleAdjustClick}
          disabled={!selectedSpec}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          Adjust
        </button>
      </div>

      {selectedSpec && (
        <div className="mt-4 p-4 bg-zinc-700 rounded-lg">
          <h4 className="text-white font-medium mb-2">Selected Specification:</h4>
          <p className="text-gray-300">{selectedSpec.name}</p>
          <p className="text-gray-400 text-sm">This will be used as the reference for comparison</p>
        </div>
      )}
    </div>
  )
} 