'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function SpecificationMaintainerFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Redirect to the dedicated page with any search params
    const params = new URLSearchParams(searchParams)
    router.push(`/specification-maintainer?${params.toString()}`)
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to Specification Maintainer...</p>
      </div>
    </div>
  )
} 