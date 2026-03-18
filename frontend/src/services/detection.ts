import api from './api'
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
  hourly: { hour: string; count: number }[]
  period: { start: string; end: string; days: number }
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

  async uploadVideo(file: File, zoneId?: number): Promise<Detection> {
    const formData = new FormData()
    formData.append('file', file)
    
    const params = zoneId ? `?zone_id=${zoneId}` : ''
    const response = await api.post(`/detection/video${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },


  async getHistory(page = 1, perPage = 20) {
    const response = await api.get(`/detection/history?page=${page}&per_page=${perPage}`)
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
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1/detection/${id}/image/result`
  },

  getResultVideoUrl(id: number): string {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1/detection/${id}/video/result`
  },
}
