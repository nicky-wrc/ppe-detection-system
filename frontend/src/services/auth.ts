import api from './api'
import type { LoginRequest, Token, User } from '../types'

interface RegisterRequest {
  email: string
  password: string
  full_name: string
  role?: string
}

export const authService = {
  async login(data: LoginRequest): Promise<Token> {
    // OAuth2PasswordRequestForm ของ FastAPI คาดหวัง application/x-www-form-urlencoded
    const params = new URLSearchParams()
    params.append('username', data.username)
    params.append('password', data.password)

    const response = await api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return response.data
  },

  async getMe(): Promise<User> {
    const response = await api.get('/auth/me')
    return response.data
  },

  async register(data: RegisterRequest): Promise<User> {
    const response = await api.post('/auth/register', {
      ...data,
      role: data.role || 'viewer',
    })
    return response.data
  },

  async requestForgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/forgot-password', {
      email,
    })
    return response.data
  },

  async confirmForgotPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
    const response = await api.post('/auth/forgot-password/confirm', {
      email,
      token,
      new_password: newPassword,
    })
    return response.data
  },

  logout() {
    localStorage.removeItem('token')
  },
}