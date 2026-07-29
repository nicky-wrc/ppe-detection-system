import { useEffect, useState } from 'react'

import { detectionService } from '../../services/detection'

interface ProtectedDetectionImageProps {
  detectionId: number
  alt: string
  className?: string
}

export function ProtectedDetectionImage({ detectionId, alt, className }: ProtectedDetectionImageProps) {
  const [result, setResult] = useState<{ id: number; url: string | null; failed: boolean }>({
    id: detectionId,
    url: null,
    failed: false,
  })

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    detectionService.getResultMediaBlob(detectionId)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setResult({ id: detectionId, url: objectUrl, failed: false })
      })
      .catch(() => {
        if (active) setResult({ id: detectionId, url: null, failed: true })
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [detectionId])

  if (result.id === detectionId && result.failed) {
    return <div className={`flex items-center justify-center bg-[#f1f5f9] text-[#94a3b8] text-[11px] ${className || ''}`}>No evidence</div>
  }
  if (result.id !== detectionId || !result.url) {
    return <div className={`animate-pulse bg-[#e2e8f0] ${className || ''}`} aria-label="Loading evidence" />
  }
  return <img src={result.url} alt={alt} className={className} />
}
