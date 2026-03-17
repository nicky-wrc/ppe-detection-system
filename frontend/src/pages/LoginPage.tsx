import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authService } from '../services/auth'
import { Shield, Lock, Eye, EyeOff, Loader2, ArrowRight, AtSign } from 'lucide-react'
import toast from 'react-hot-toast'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { setToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const tokenData = await authService.login({ username: email, password })
      setToken(tokenData.access_token)
      const user = await authService.getMe()
      setUser(user)
      toast.success('เข้าสู่ระบบสำเร็จ')
      navigate('/')
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full bg-[#f8f9fc] overflow-hidden font-sans">
      
      {/* Left Panel */}
      <div className="hidden lg:block w-1/2 bg-[url('/bglogin.png')] bg-cover bg-center bg-no-repeat"></div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 lg:px-12 bg-[#f8fafc]">
        <div className="w-full max-w-[400px]">

          {/* Header */}
          <h2 className="text-3xl font-extrabold text-[#0f172a] mb-2">
            Welcome Back
          </h2>
          <p className="text-[#64748b] text-sm mb-8">
            Access the Secure Industrial Portal with your credentials.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            
            {/* Email */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-[#334155] mb-2 flex items-center gap-2">
                <AtSign className="w-4 h-4" />
                Username or Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full px-4 py-3 rounded-lg border border-[#e2e8f0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9] transition"
              />
            </div>

            {/* Password */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#334155] flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <a href="#" className="text-xs text-[#0ea5e9] hover:underline">
                  Forgot password?
                </a>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-10 rounded-lg border border-[#e2e8f0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9] transition"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-4 w-full py-3 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}
