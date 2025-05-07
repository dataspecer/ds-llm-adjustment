'use client'

import UploadForm from './components/UploadForm'

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          API Schema Change Analyzer
        </h1>

        <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
          <UploadForm />
        </div>
      </div>
    </main>
  )
}
