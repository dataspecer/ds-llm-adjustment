'use client'

import UploadForm from './components/UploadForm'

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-900 text-white">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg text-white">Dataspecer</span>
          <span className="text-lg text-gray-300">Adjuster</span>
        </div>
      </nav>
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
            <UploadForm />
          </div>
        </div>
      </main>
    </div>
  )
}
