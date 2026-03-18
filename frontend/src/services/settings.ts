import api from './api'
import type { UserSettings } from '../types'

export type UserSettingsUpdate = Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at'>>

export const settingsService = {
  async getMe(): Promise<UserSettings> {
    const response = await api.get('/settings/me')
    return response.data
  },

  async updateMe(payload: UserSettingsUpdate): Promise<UserSettings> {
    const response = await api.put('/settings/me', payload)
    return response.data
  },
}

