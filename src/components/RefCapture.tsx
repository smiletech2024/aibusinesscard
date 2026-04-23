'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function RefCapture() {
  const params = useSearchParams()
  useEffect(() => {
    const ref = params.get('ref')
    if (ref && typeof window !== 'undefined') {
      localStorage.setItem('aimeishi_ref', ref)
    }
  }, [params])
  return null
}
