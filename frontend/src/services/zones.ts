import api from './api'
import type { Zone } from '../types'

export const zonesService = {
  async list(): Promise<Zone[]> {
    const response = await api.get('/zones')
    return response.data
  },

  async update(id: number, payload: Partial<Pick<Zone, 'name' | 'description' | 'required_ppe' | 'is_active'>>): Promise<Zone> {
    const response = await api.put(`/zones/${id}`, payload)
    return response.data
  },
}

