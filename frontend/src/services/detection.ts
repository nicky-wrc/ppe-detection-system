import api from './api'
import { API_ORIGIN } from './api'
import type { Detection, DetectionStats } from '../types'

export interface DailyData {
  date: string
  day: string
  detections: number
  persons: number
  violations: number
  compliance: number
}

export interface AnalyticsData {
  daily: DailyData[]
  hourly: {
    hour: string
    count: number
    detections?: number
    persons?: number
    violations?: number
    compliance?: number
  }[]
  period: { start: string; end: string; days: number }
}

export interface DetectionHistoryResponse {
  items: Detection[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export const detectionService = {
  async uploadImage(file: File, zoneId?: number): Promise<Detection> {
    const formData = new FormData()
    formData.append('file', file)
    
    const params = zoneId ? `?zone_id=${zoneId}` : ''
    const response = await api.post(`/detection/image${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async detectFrame(file: File, zoneId?: number): Promise<Detection> {
    const formData = new FormData()
    formData.append('file', file)

    const params = zoneId ? `?zone_id=${zoneId}` : ''
    const response = await api.post(`/detection/frame${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async uploadVideo(file: File, zoneId?: number): Promise<Detection> {
    const formData = new FormData()
    formData.append('file', file)
    
    const params = zoneId ? `?zone_id=${zoneId}` : ''
    const response = await api.post(`/detection/video${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },


  async getHistory(page = 1, perPage = 20, hasViolation?: boolean): Promise<DetectionHistoryResponse> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    })
    if (hasViolation !== undefined) params.set('has_violation', String(hasViolation))
    const response = await api.get(`/detection/history?${params.toString()}`)
    return response.data
  },

  async getStats(): Promise<DetectionStats> {
    const response = await api.get('/detection/stats')
    return response.data
  },

  async getAnalytics(days = 7, startDate?: string, endDate?: string): Promise<AnalyticsData> {
    let url = `/detection/analytics/daily?days=${days}`
    if (startDate && endDate) {
      url += `&start_date=${startDate}&end_date=${endDate}`
    }
    const response = await api.get(url)
    return response.data
  },

  async getDetection(id: number): Promise<Detection> {
    const response = await api.get(`/detection/${id}`)
    return response.data
  },

  getResultImageUrl(id: number): string {
    return `${API_ORIGIN}/api/v1/detection/${id}/image/result`
  },

  /**
   * Fetches annotated result file (image or video) for PDF embedding.
   * Uses axios first; falls back to the same URL as thumbnails (no auth — endpoint is open)
   * so PDF generation still works if axios/blob handling fails.
   */
  async getResultMediaBlob(detectionId: number): Promise<Blob> {
    const normalizeType = (blob: Blob, contentType: string | null | undefined): Blob => {
      const ct = (contentType || '').split(';')[0].trim().toLowerCase()
      if (ct && (!blob.type || blob.type === 'application/octet-stream')) {
        return new Blob([blob], { type: ct })
      }
      return blob
    }

    try {
      const response = await api.get(`/detection/${detectionId}/image/result`, {
        responseType: 'blob',
      })
      const raw = response.data as Blob
      const headerCt = response.headers['content-type'] as string | undefined
      const blob = normalizeType(raw, headerCt)
      if (blob.size < 2048 && (blob.type || '').includes('json')) {
        const msg = await raw.text()
        throw new Error(msg || 'Unexpected JSON body')
      }
      return blob
    } catch {
      const url = this.getResultImageUrl(detectionId)
      const token = localStorage.getItem('token')
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        throw new Error(`Failed to load result media: ${res.status}`)
      }
      const blob = await res.blob()
      return normalizeType(blob, res.headers.get('content-type'))
    }
  },

  getResultVideoUrl(id: number): string {
    return `${API_ORIGIN}/api/v1/detection/${id}/video/result`
  },

  async getResultVideoBlob(detectionId: number): Promise<Blob> {
    const response = await api.get(`/detection/${detectionId}/video/result`, {
      responseType: 'blob',
    })
    const raw = response.data as Blob
    const contentType = String(response.headers['content-type'] || '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    if (contentType && raw.type !== contentType) {
      return new Blob([raw], { type: contentType })
    }
    return raw
  },
}
