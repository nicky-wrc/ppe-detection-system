import api from './api'
import type { UserSettings } from '../types'

export type UserSettingsUpdate = Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at'>>

const SETTINGS_EVENT = 'ppe:settings-updated'
const SETTINGS_STORAGE_KEY = 'ppe:settings-revision'

function normalizeSettings(value: UserSettings): UserSettings {
  return {
    ...value,
    alert_sound: value.alert_sound ?? true,
    save_evidence: value.save_evidence ?? true,
    confidence_threshold: value.confidence_threshold ?? 25,
    ppe_detection_sensitivity: value.ppe_detection_sensitivity ?? 60,
    active_ppe_rules: Object.keys(value.active_ppe_rules || {}).length
      ? value.active_ppe_rules
      : { helmet: true, 'safety-vest': true },
  }
}

export const settingsService = {
  async getMe(): Promise<UserSettings> {
    const response = await api.get('/settings/me')
    return normalizeSettings(response.data)
  },

  async updateMe(payload: UserSettingsUpdate): Promise<UserSettings> {
    const response = await api.put('/settings/me', payload)
    const updated = normalizeSettings(response.data)
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: updated }))
    try {
      // Notify other tabs; saved preferences remain authoritative in the database.
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ userId: updated.user_id, revision: Date.now() }))
    } catch {
      // Focus refresh still works when browser storage is unavailable.
    }
    return updated
  },

  subscribe(userId: number, onUpdate: (value: UserSettings) => void, onError: () => void): () => void {
    let active = true
    let revision = 0
    const refresh = () => {
      const request = ++revision
      void settingsService.getMe().then((value) => {
        if (active && request === revision && value.user_id === userId) onUpdate(value)
      }).catch(() => {
        if (active && request === revision) onError()
      })
    }
    const onLocalUpdate = (event: Event) => {
      const value = (event as CustomEvent<UserSettings>).detail
      if (value?.user_id === userId) {
        revision += 1
        onUpdate(value)
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === SETTINGS_STORAGE_KEY) refresh()
    }
    window.addEventListener(SETTINGS_EVENT, onLocalUpdate)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    refresh()
    return () => {
      active = false
      window.removeEventListener(SETTINGS_EVENT, onLocalUpdate)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refresh)
    }
  },
}

