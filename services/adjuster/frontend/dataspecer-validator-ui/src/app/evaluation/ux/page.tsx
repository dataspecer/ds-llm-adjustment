'use client'

import { useState, useEffect } from 'react'
import { api, UxSurveyDto, UxRole } from '../../services/api'
import Link from 'next/link'

export default function UxSurveyPage() {
  const [runId, setRunId] = useState<string>('')
  const [dialogId, setDialogId] = useState<string>('')
  const [role, setRole] = useState<UxRole>('Maintainer')
  const [helpfulness, setHelpfulness] = useState<number>(5)
  const [sus, setSus] = useState<number>(70)
  const [susItems, setSusItems] = useState<number[]>([3,3,3,3,3,3,3,3,3,3]) // 1-5
  const [comments, setComments] = useState<string>('')
  const [ok, setOk] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Prefill from query params when navigated from results
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const d = sp.get('dialogId')
      const r = sp.get('runId')
      if (d && !dialogId) setDialogId(d)
      if (r && !runId) setRunId(r)
    } catch {}
  }, [])

  const susStatements = [
    'I think that I would like to use this system frequently.',
    'I found the system unnecessarily complex.',
    'I thought the system was easy to use.',
    'I think that I would need the support of a technical person to be able to use this system.',
    'I found the various functions in this system were well integrated.',
    'I thought there was too much inconsistency in this system.',
    'I would imagine that most people would learn to use this system very quickly.',
    'I found the system very cumbersome to use.',
    'I felt very confident using the system.',
    'I needed to learn a lot of things before I could get going with this system.'
  ]

  function computeSusScore(items: number[]): number {
    if (!items || items.length !== 10) return NaN
    // SUS scoring: sum of adjusted scores * 2.5
    // Odd-indexed (1-based): score = item - 1; Even-indexed: score = 5 - item
    let sum = 0
    for (let i = 0; i < 10; i++) {
      const val = items[i]
      if (i % 2 === 0) sum += (val - 1)
      else sum += (5 - val)
    }
    return Math.round(sum * 2.5)
  }

  function setSusItem(idx: number, val: number) {
    setSusItems(prev => {
      const next = prev.slice()
      next[idx] = val
      const computed = computeSusScore(next)
      if (Number.isFinite(computed)) setSus(computed)
      return next
    })
  }

  const submit = async () => {
    setOk(false)
    setError(null)
    setLoading(true)
    const payload: UxSurveyDto = {
      runId: runId || undefined,
      dialogId: dialogId || undefined,
      role,
      helpfulnessLikert: helpfulness,
      susItems,
      susScore: sus,
      comments: comments || undefined,
    }
    const resp = await api.submitUxSurvey(payload)
    setLoading(false)
    if (resp.error) {
      setError(resp.error)
    } else if (resp.data?.ok) {
      setOk(true)
      setComments('')
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
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-zinc-800 rounded-lg p-6 shadow-lg">
            <h1 className="text-xl font-semibold mb-4">UX & Safety Survey</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Run ID (optional)</label>
                <input value={runId} onChange={e => setRunId(e.target.value)} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Dialog ID (optional)</label>
                <input value={dialogId} onChange={e => setDialogId(e.target.value)} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value as UxRole)} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none">
                  <option value="Developer">Developer</option>
                  <option value="Maintainer">Maintainer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Helpfulness (1-7)</label>
                <input type="number" min={1} max={7} value={helpfulness} onChange={e => setHelpfulness(Number(e.target.value))} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">SUS Score (auto-computed)</label>
                <input type="number" min={0} max={100} value={sus} onChange={e => setSus(Number(e.target.value))} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none" />
              </div>
            </div>
            <div className="mt-6">
              <div className="text-sm text-gray-300 mb-2">System Usability Scale (1-5)</div>
              <div className="space-y-3">
                {susStatements.map((label, idx) => (
                  <div key={idx} className="bg-zinc-700 rounded p-3">
                    <div className="text-sm text-gray-200 mb-2">{idx + 1}. {label}</div>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(v => (
                        <button
                          key={v}
                          onClick={() => setSusItem(idx, v)}
                          className={`px-3 py-1 rounded text-sm ${susItems[idx] === v ? 'bg-blue-600 text-white' : 'bg-zinc-600 text-gray-200 hover:bg-zinc-500'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-300 mb-1">Comments (optional)</label>
              <textarea value={comments} onChange={e => setComments(e.target.value)} rows={5} className="w-full bg-zinc-700 rounded px-3 py-2 outline-none" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={submit} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{loading ? 'Submitting...' : 'Submit Survey'}</button>
              {ok && <span className="text-green-400 text-sm">Thank you! Saved.</span>}
              {error && <span className="text-red-400 text-sm">{error}</span>}
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Safety indicators (MCP preview/apply order, guardrails, audit trail) are tracked automatically during usage.
          </div>
        </div>
      </main>
    </div>
  )
}



