'use client'

import { useState } from 'react'
import { api, DiffQualityInputDto, DiffQualityResultDto, EvalTypedChangeRef } from '../../services/api'
import Link from 'next/link'

export default function DiffEvaluationPage() {
  const [runId, setRunId] = useState<string>('')
  const [goldText, setGoldText] = useState<string>('[]')
  const [predictedText, setPredictedText] = useState<string>('[]')
  const [result, setResult] = useState<DiffQualityResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const submit = async () => {
    setError(null)
    setResult(null)
    let gold: EvalTypedChangeRef[] = []
    let predicted: EvalTypedChangeRef[] = []
    try {
      gold = JSON.parse(goldText)
      predicted = JSON.parse(predictedText)
      if (!Array.isArray(gold) || !Array.isArray(predicted)) throw new Error('gold/predicted must be arrays')
    } catch (e: any) {
      setError(`Invalid JSON: ${e?.message || 'parse error'}`)
      return
    }
    setLoading(true)
    const payload: DiffQualityInputDto = { runId: runId || `${Date.now()}`, gold, predicted }
    const resp = await api.submitEvaluationDiff(payload)
    setLoading(false)
    if (resp.error) {
      setError(resp.error)
    } else if (resp.data) {
      setResult(resp.data)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-900 text-white">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg text-white">Dataspecer</span>
          <span className="text-lg text-gray-300">Adjuster</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/evaluation" className="px-3 py-1 rounded text-sm transition-colors text-gray-400 hover:text-white hover:bg-zinc-700">Back</Link>
        </div>
      </nav>
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
            <h1 className="text-xl font-semibold mb-4">Diff & Classification Quality</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1">
                <label className="block text-sm text-gray-300 mb-1">Run ID</label>
                <input value={runId} onChange={e => setRunId(e.target.value)} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none" placeholder="optional (auto if empty)" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Gold (JSON array of {`{id,type,path}`})</label>
                <textarea value={goldText} onChange={e => setGoldText(e.target.value)} rows={12} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none font-mono text-sm"></textarea>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Predicted (JSON array of {`{id,type,path}`})</label>
                <textarea value={predictedText} onChange={e => setPredictedText(e.target.value)} rows={12} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none font-mono text-sm"></textarea>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={submit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{loading ? 'Computing...' : 'Compute & Store'}</button>
              {error && <span className="text-red-400 text-sm">{error}</span>}
            </div>
          </div>

          {result && (
            <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-lg font-semibold mb-3">Results (Run: {result.runId})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-2">Micro-averaged</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>Precision: {result.microAveraged.precision.toFixed(3)}</div>
                    <div>Recall: {result.microAveraged.recall.toFixed(3)}</div>
                    <div>F1: {result.microAveraged.f1.toFixed(3)}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Per type</h3>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="text-left py-1 pr-2">Type</th>
                          <th className="text-left py-1 pr-2">P</th>
                          <th className="text-left py-1 pr-2">R</th>
                          <th className="text-left py-1 pr-2">F1</th>
                          <th className="text-left py-1 pr-2">TP</th>
                          <th className="text-left py-1 pr-2">FP</th>
                          <th className="text-left py-1 pr-2">FN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.perType.map(row => (
                          <tr key={row.type} className="border-t border-zinc-700">
                            <td className="py-1 pr-2">{row.type}</td>
                            <td className="py-1 pr-2">{row.precision.toFixed(3)}</td>
                            <td className="py-1 pr-2">{row.recall.toFixed(3)}</td>
                            <td className="py-1 pr-2">{row.f1.toFixed(3)}</td>
                            <td className="py-1 pr-2">{row.truePositives}</td>
                            <td className="py-1 pr-2">{row.falsePositives}</td>
                            <td className="py-1 pr-2">{row.falseNegatives}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}



