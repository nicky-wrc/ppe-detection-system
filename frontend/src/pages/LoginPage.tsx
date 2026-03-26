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
    <div className="flex min-h-screen w-full bg-[#f1f5f9] overflow-hidden font-sans">
      {/* Left Panel */}
      <div className="hidden lg:block w-1/2 bg-[url('/bglogin.png')] bg-cover bg-center bg-no-repeat" />

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-10 lg:px-14 bg-gradient-to-br from-[#f8fbff] to-[#f1f5f9]">
        <div className="w-full max-w-[560px] rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] px-8 py-10 sm:px-11 sm:py-12">
          {/* Header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dbeafe] bg-[#eff6ff] px-3 py-1.5 mb-6">
              <Shield className="w-4 h-4 text-[#2563eb]" />
              <span className="text-[12px] font-semibold tracking-[0.03em] text-[#1d4ed8]" style={{ wordSpacing: '0.08em' }}>
                PPE Guard System
              </span>
            </div>
            <h2 className="text-[34px] leading-[1.2] font-extrabold tracking-[0.01em] text-[#0f172a] mb-4" style={{ wordSpacing: '0.06em' }}>
              Welcome Back
            </h2>
            <p className="text-[#64748b] text-[16px] leading-7 tracking-[0.01em]" style={{ wordSpacing: '0.05em' }}>
              Access the secure industrial portal with your credentials.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[14px] flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="mb-9">
              <label className="block text-[15px] font-semibold text-[#334155] mb-4 flex items-center gap-2 tracking-[0.01em]" style={{ wordSpacing: '0.05em' }}>
                <AtSign className="w-4 h-4" />
                Username or Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full h-[56px] px-5 rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] text-[16px] font-medium text-[#0f172a] placeholder:text-[#93a4ba] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/20 focus:border-[#38bdf8] focus:bg-white transition"
              />
            </div>

            {/* Password */}
            <div className="mb-11">
              <div className="flex justify-between items-center mb-4">
                <label className="text-[15px] font-semibold text-[#334155] flex items-center gap-2 tracking-[0.01em]" style={{ wordSpacing: '0.05em' }}>
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <a href="#" className="text-[13px] font-medium text-[#0284c7] hover:underline tracking-[0.01em]" style={{ wordSpacing: '0.05em' }}>
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
                  className="w-full h-[56px] px-5 pr-12 rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] text-[16px] font-medium text-[#0f172a] placeholder:text-[#93a4ba] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/20 focus:border-[#38bdf8] focus:bg-white transition"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] transition"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-5 w-full py-3.5 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold text-[16px] tracking-[0.01em] transition flex items-center justify-center gap-2 shadow-[0_10px_18px_rgba(14,165,233,0.28)] disabled:opacity-70 disabled:shadow-none"
              style={{ wordSpacing: '0.06em' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
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
