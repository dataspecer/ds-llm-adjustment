'use client'

import { useRouter } from 'next/navigation'

export default function EvaluationHome() {
  const router = useRouter()
  return (
    <div className="flex flex-col min-h-screen bg-zinc-900 text-white">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg text-white">Dataspecer</span>
          <span className="text-lg text-gray-300">Adjuster</span>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/')} className="px-3 py-1 rounded text-sm transition-colors text-gray-400 hover:text-white hover:bg-zinc-700">Home</button>
        </div>
      </nav>
      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
            <h1 className="text-xl font-semibold mb-4">Evaluation</h1>
            <p className="text-gray-300 mb-6">Submit evaluation inputs and surveys.</p>
            <div className="flex gap-4">
              <button onClick={() => router.push('/evaluation/diff')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Diff & Classification</button>
              <button onClick={() => router.push('/evaluation/ux')} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">UX & SUS Survey</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}



