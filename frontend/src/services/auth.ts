import api from './api'
import type { LoginRequest, Token, User } from '../types'

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

  logout() {
    localStorage.removeItem('token')
  },
}