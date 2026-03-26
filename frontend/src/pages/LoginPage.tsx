import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authService } from '../services/auth'
import { Shield, Lock, Eye, EyeOff, Loader2, ArrowRight, AtSign } from 'lucide-react'
import toast from 'react-hot-toast'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotToken, setForgotToken] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [activePanel, setActivePanel] = useState<'login' | 'register' | 'forgot'>('login')
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await authService.register({
        email: registerEmail,
        password: registerPassword,
        full_name: fullName,
      })
      toast.success('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ')
      setActivePanel('login')
      setEmail(registerEmail)
      setPassword('')
      setFullName('')
      setRegisterEmail('')
      setRegisterPassword('')
    } catch {
      setError('ไม่สามารถสมัครสมาชิกได้ กรุณาตรวจสอบข้อมูล')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      if (!forgotToken.trim()) {
        await authService.requestForgotPassword(forgotEmail)
        toast.success('ส่งคำขอรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบรหัสยืนยัน')
      } else {
        await authService.confirmForgotPassword(forgotEmail, forgotToken, forgotNewPassword)
        toast.success('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')
        setActivePanel('login')
        setEmail(forgotEmail)
        setPassword('')
        setForgotEmail('')
        setForgotToken('')
        setForgotNewPassword('')
      }
    } catch {
      setError('ไม่สามารถรีเซ็ตรหัสผ่านได้ กรุณาตรวจสอบอีเมล')
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
                PPE Detection System
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

          {activePanel === 'login' && (
            <>
              <form onSubmit={handleSubmit}>
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

                <div className="mb-12">
                  <label className="text-[15px] font-semibold text-[#334155] flex items-center gap-2 tracking-[0.01em] mb-4" style={{ wordSpacing: '0.05em' }}>
                    <Lock className="w-4 h-4" />
                    Password
                  </label>
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
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold text-[16px] tracking-[0.01em] transition flex items-center justify-center gap-2 shadow-[0_10px_18px_rgba(14,165,233,0.28)] disabled:opacity-70 disabled:shadow-none"
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

              <div className="mt-7 pt-6 border-t border-[#e2e8f0] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActivePanel('register')}
                  className="text-[14px] font-semibold text-[#1d4ed8] hover:text-[#1e40af] bg-transparent border-none cursor-pointer"
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('forgot')}
                  className="text-[14px] font-semibold text-[#0284c7] hover:text-[#0369a1] bg-transparent border-none cursor-pointer"
                >
                  Forgot password
                </button>
              </div>
            </>
          )}

          {activePanel === 'register' && (
            <div className="mt-1">
              <div className="flex items-center justify-between mb-7">
                <h3 className="text-[24px] font-bold text-[#0f172a] m-0">Create account</h3>
                <button
                  type="button"
                  onClick={() => setActivePanel('login')}
                  className="text-[14px] font-semibold text-[#2563eb] hover:underline bg-transparent border-none cursor-pointer"
                >
                  Back to login
                </button>
              </div>
              <form onSubmit={handleRegister} className="space-y-5">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  required
                  className="w-full h-[54px] px-5 rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] text-[15px] focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/20 focus:border-[#38bdf8]"
                />
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="w-full h-[54px] px-5 rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] text-[15px] focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/20 focus:border-[#38bdf8]"
                />
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full h-[54px] px-5 pr-12 rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] text-[15px] focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/20 focus:border-[#38bdf8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] transition"
                  >
                    {showRegisterPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[50px] rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-[15px] font-semibold border-none cursor-pointer disabled:opacity-70"
                >
                  Create account
                </button>
              </form>
            </div>
          )}

          {activePanel === 'forgot' && (
            <div className="mt-1">
              <div className="flex items-center justify-between mb-7">
                <h3 className="text-[24px] font-bold text-[#0f172a] m-0">Reset password</h3>
                <button
                  type="button"
                  onClick={() => setActivePanel('login')}
                  className="text-[14px] font-semibold text-[#2563eb] hover:underline bg-transparent border-none cursor-pointer"
                >
                  Back to login
                </button>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  className="w-full h-[54px] px-5 rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] text-[15px] focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/20 focus:border-[#38bdf8]"
                />
                <input
                  type="text"
                  value={forgotToken}
                  onChange={(e) => setForgotToken(e.target.value)}
                  placeholder="Reset code (จากอีเมล)"
                  className="w-full h-[54px] px-5 rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] text-[15px] focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/20 focus:border-[#38bdf8]"
                />
                <div className="relative">
                  <input
                    type={showForgotPassword ? 'text' : 'password'}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="New password"
                    required={Boolean(forgotToken.trim())}
                    className="w-full h-[54px] px-5 pr-12 rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] text-[15px] focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/20 focus:border-[#38bdf8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(!showForgotPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] transition"
                  >
                    {showForgotPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[50px] rounded-xl bg-[#0f766e] hover:bg-[#0f766e]/90 text-white text-[15px] font-semibold border-none cursor-pointer disabled:opacity-70"
                >
                  {forgotToken.trim() ? 'Confirm reset password' : 'Send reset code'}
                </button>
                <p className="text-[12px] text-[#64748b] m-0">
                  เพื่อความปลอดภัย ระบบจะไม่เปลี่ยนรหัสผ่านจากแค่อีเมล ต้องยืนยันด้วยรหัสรีเซ็ตก่อน
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
