import api from './api'
import type { ActiveModelInfo } from '../types'

export const modelsService = {
  async getActive(): Promise<ActiveModelInfo> {
    const response = await api.get('/models/active', { timeout: 10000 })
    return response.data
  },
}
