import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authService } from '../services/auth'
import { Shield, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
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
    <div className="h-screen w-full flex overflow-hidden" style={{ backgroundColor: '#0a0e17' }}>

      {/* Left Panel - Branding (takes 55% on large screens) */}
      <div
        className="hidden lg:flex w-[55%] relative items-center justify-center px-16 xl:px-24 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0c1222 0%, #162040 50%, #0c1222 100%)' }}
      >
        {/* Background glow effects */}
        <div className="absolute inset-0 opacity-25 pointer-events-none">
          <div className="absolute top-[10%] left-[5%] w-[50%] h-[50%] rounded-full bg-cyan-500 blur-[180px]" />
          <div className="absolute bottom-[5%] right-[5%] w-[45%] h-[45%] rounded-full bg-blue-600 blur-[160px]" />
        </div>

        <div className="relative z-10 max-w-2xl">
          {/* Logo icon */}
          <div className="w-24 h-24 bg-[#06b6d4]/15 backdrop-blur-md rounded-3xl flex items-center justify-center mb-12 border border-[#06b6d4]/25">
            <Shield className="w-12 h-12 text-[#06b6d4]" />
          </div>

          {/* Heading */}
          <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.15] mb-8">
            <span className="text-white">ระบบตรวจจับ</span>
            <br />
            <span className="text-[#06b6d4]">อุปกรณ์ความปลอดภัย</span>
            <br />
            <span className="text-white">ด้วย AI อัจฉริยะ</span>
          </h1>

          {/* Description */}
          <p className="text-xl text-slate-300/80 leading-relaxed mb-14 max-w-xl">
            ยกระดับความปลอดภัยในพื้นที่ทำงาน ด้วยเทคโนโลยีคอมพิวเตอร์วิทัศน์
            ที่วิเคราะห์และแจ้งเตือนการฝ่าฝืนแบบเรียลไทม์
          </p>

          {/* Stats bar */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-2xl">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <p className="text-3xl font-bold text-[#06b6d4]">YOLOv8</p>
                <p className="text-sm text-slate-400 mt-2">AI Model</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#06b6d4]">&lt;100ms</p>
                <p className="text-sm text-slate-400 mt-2">Processing</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#06b6d4]">24/7</p>
                <p className="text-sm text-slate-400 mt-2">Monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form (takes 45%) */}
      <div className="w-full lg:w-[45%] flex items-center justify-center px-8 sm:px-16 xl:px-20">
        <div className="w-full max-w-lg">

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-4 mb-12">
            <div className="w-14 h-14 bg-[#06b6d4]/20 rounded-2xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#06b6d4]" />
            </div>
            <span className="font-bold text-white text-2xl">PPE Guard AI</span>
          </div>

          {/* Welcome */}
          <div className="mb-12">
            <h2 className="text-4xl font-bold text-white mb-3">ยินดีต้อนรับกลับมา</h2>
            <p className="text-lg text-slate-400">กรุณาเข้าสู่ระบบเพื่อเข้าใช้งาน Dashboard</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-8 p-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-base font-medium flex items-center gap-3">
              <Shield className="w-6 h-6 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="space-y-2.5">
              <label className="text-base font-semibold text-slate-300 ml-1">อีเมล</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail className="h-6 w-6 text-slate-500 group-focus-within:text-[#06b6d4] transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ppe-system.com"
                  required
                  className="block w-full pl-14 pr-5 py-4.5 bg-[#111827] border border-[#1e293b] rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#06b6d4]/30 focus:border-[#06b6d4] transition-all"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-base font-semibold text-slate-300 ml-1">รหัสผ่าน</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-6 w-6 text-slate-500 group-focus-within:text-[#06b6d4] transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full pl-14 pr-14 py-4.5 bg-[#111827] border border-[#1e293b] rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#06b6d4]/30 focus:border-[#06b6d4] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4.5 px-6 rounded-xl text-lg font-bold text-white bg-[#06b6d4] hover:bg-[#22d3ee] focus:outline-none focus:ring-2 focus:ring-[#06b6d4]/50 disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-2"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>กำลังตรวจสอบข้อมูล...</span>
                </div>
              ) : (
                <span>เข้าสู่ระบบ</span>
              )}
            </button>
          </form>

          {/* Demo Account */}
          <div className="mt-10 pt-10 border-t border-[#1e293b]">
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
              <p className="text-base font-bold text-slate-300 mb-4">บัญชีสำหรับทดสอบ (Demo)</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-2">EMAIL</p>
                  <p className="text-base font-mono text-[#06b6d4] bg-[#0a0e17] px-4 py-2.5 rounded-lg border border-[#1e293b]">
                    admin@ppe-system.com
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-2">PASSWORD</p>
                  <p className="text-base font-mono text-[#06b6d4] bg-[#0a0e17] px-4 py-2.5 rounded-lg border border-[#1e293b]">
                    admin123
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
