import api from './api'
import type { Alert } from '../types'

export interface AlertsListResponse {
  items: Alert[]
  total: number
  page: number
  per_page: number
}

export const alertsService = {
  async list(page = 1, perPage = 20, status?: string): Promise<AlertsListResponse> {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('per_page', String(perPage))
    if (status) params.set('status', status)
    const response = await api.get(`/alerts/?${params.toString()}`)
    return response.data
  },

  async acknowledge(id: number): Promise<Alert> {
    const response = await api.put(`/alerts/${id}/acknowledge`)
    return response.data
  },

  async resolve(id: number, resolution_note?: string): Promise<Alert> {
    const response = await api.put(`/alerts/${id}/resolve`, { resolution_note })
    return response.data
  },
}

