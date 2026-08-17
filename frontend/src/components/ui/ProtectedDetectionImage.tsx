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
    return <div className={`flex items-center justify-center bg-[var(--apple-parchment)] text-[var(--muted)] text-[12px] ${className || ''}`}>No evidence</div>
  }
  if (result.id !== detectionId || !result.url) {
    return <div className={`animate-pulse bg-[#e8e8ed] ${className || ''}`} aria-label="Loading evidence" />
  }
  return <img src={result.url} alt={alt} className={className} />
}
