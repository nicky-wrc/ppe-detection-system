import api from './api'
import { WS_ORIGIN } from './api'
import type { CameraTestResult, EdgeCamera } from '../types'

export interface CameraCreatePayload {
  name: string
  source_type: 'usb' | 'rtsp'
  device_index?: number
  rtsp_url?: string
  location?: string
  zone_id?: number
  config?: Record<string, unknown>
}

export const camerasService = {
  async list(): Promise<EdgeCamera[]> {
    const response = await api.get('/cameras/')
    return response.data
  },

  async create(payload: CameraCreatePayload): Promise<EdgeCamera> {
    const response = await api.post('/cameras/', payload)
    return response.data
  },

  async test(id: number): Promise<CameraTestResult> {
    const response = await api.post(`/cameras/${id}/test`)
    return response.data
  },

  async start(id: number): Promise<EdgeCamera> {
    const response = await api.post(`/cameras/${id}/start`)
    return response.data
  },

  async stop(id: number): Promise<EdgeCamera> {
    const response = await api.post(`/cameras/${id}/stop`)
    return response.data
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/cameras/${id}`)
  },

  connect(room: 'cameras' | 'alerts', onMessage: (message: unknown) => void): WebSocket | null {
    const token = localStorage.getItem('token')
    if (!token) return null
    const url = `${WS_ORIGIN}/api/v1/ws/events?room=${room}&token=${encodeURIComponent(token)}`
    const socket = new WebSocket(url)
    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data))
      } catch {
        // Ignore malformed messages; polling remains the fallback.
      }
    }
    return socket
  },
}
