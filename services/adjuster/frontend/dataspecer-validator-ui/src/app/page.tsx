'use client'

import { Suspense, useState, useEffect } from 'react'
import UploadForm from './components/UploadForm'
import SpecificationMaintainerFlow from './components/SpecificationMaintainerFlow'
import { useSearchParams, useRouter } from 'next/navigation'

function UploadFormWithSuspense() {
  return (
    <Suspense fallback={
      <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
        <div className="text-center text-gray-400">Loading...</div>
      </div>
    }>
      <UploadForm />
    </Suspense>
  )
}

function SpecificationMaintainerWithSuspense() {
  return (
    <Suspense fallback={
      <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
        <div className="text-center text-gray-400">Loading...</div>
      </div>
    }>
      <SpecificationMaintainerFlow />
    </Suspense>
  )
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [mode, setMode] = useState<'developer' | 'maintainer'>('developer')

  useEffect(() => {
    // Check URL parameters to determine initial mode
    const urlMode = searchParams.get('mode')
    const psmSchema = searchParams.get('data-psm-schema')
    const dataSpecification = searchParams.get('data-specification')
    
    // If PSM parameters are present or mode=maintainer, set to maintainer mode
    if (urlMode === 'maintainer' || (psmSchema && dataSpecification)) {
      setMode('maintainer')
    }
  }, [searchParams])

  return (
    <div className="flex flex-col min-h-screen bg-zinc-900 text-white">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg text-white">Dataspecer</span>
          <span className="text-lg text-gray-300">Adjuster</span>
        </div>
        
        {/* Navigation Links */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/accepted-changes')}
            className="px-3 py-1 rounded text-sm transition-colors text-gray-400 hover:text-white hover:bg-zinc-700"
          >
            Accepted Changes
          </button>
          
          <div className="border-l border-zinc-600 h-6"></div>
          
          <span className="text-sm text-gray-400">Mode:</span>
          <div className="flex bg-zinc-700 rounded-lg p-1">
            <button
              onClick={() => setMode('developer')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                mode === 'developer'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Developer
            </button>
            <button
              onClick={() => setMode('maintainer')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                mode === 'maintainer'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Specification Maintainer
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Quick Actions Bar */}
          <div className="mb-6 flex justify-between items-center">
            <div className="flex space-x-3">
              <button
                onClick={() => router.push('/accepted-changes')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <span>View Accepted Changes</span>
              </button>
            </div>
            <div className="text-sm text-gray-400">
              Quick access to review results
            </div>
          </div>

          <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
            {mode === 'developer' ? (
              <UploadFormWithSuspense />
            ) : (
              <SpecificationMaintainerWithSuspense />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen bg-zinc-900 text-white">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center text-gray-400">Loading...</div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
