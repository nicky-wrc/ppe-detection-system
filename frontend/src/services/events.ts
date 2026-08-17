import api from './api'
import type { ViolationEvent } from '../types'

export interface EventsListResponse {
  items: ViolationEvent[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export const eventsService = {
  async list(page = 1, perPage = 20, status?: string): Promise<EventsListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (status) params.set('status', status)
    const response = await api.get(`/events/?${params.toString()}`)
    return response.data
  },

  async acknowledge(id: number): Promise<ViolationEvent> {
    const response = await api.put(`/events/${id}/acknowledge`)
    return response.data
  },

  async resolve(id: number, notes?: string): Promise<ViolationEvent> {
    const response = await api.put(`/events/${id}/resolve`, { notes })
    return response.data
  },

  async getEvidenceBlob(id: number, kind: 'snapshot' | 'clip'): Promise<Blob> {
    const response = await api.get(`/events/${id}/evidence/${kind}`, { responseType: 'blob' })
    return response.data
  },
}
