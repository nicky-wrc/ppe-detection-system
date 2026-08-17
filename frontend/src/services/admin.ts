import api from './api'
import type { User } from '../types'

export interface AdminUserCreate {
  email: string
  full_name: string
  password: string
  role: 'admin' | 'safety_officer' | 'viewer'
}

export const adminService = {
  async listUsers(): Promise<User[]> {
    const response = await api.get('/admin/users')
    return response.data
  },

  async createUser(payload: AdminUserCreate): Promise<User> {
    const response = await api.post('/admin/users', payload)
    return response.data
  },

  async updateUser(id: number, payload: Partial<Pick<User, 'role' | 'is_active'>>): Promise<User> {
    const response = await api.patch(`/admin/users/${id}`, payload)
    return response.data
  },
}
