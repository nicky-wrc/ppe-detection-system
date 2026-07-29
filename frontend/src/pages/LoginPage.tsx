import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, AtSign, Cpu, Eye, EyeOff, Loader2, Lock, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

import { authService } from '../services/auth'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { setToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const tokenData = await authService.login({ username: email, password })
      setToken(tokenData.access_token)
      setUser(await authService.getMe())
      toast.success('เข้าสู่ระบบสำเร็จ')
      navigate('/')
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <section className="login-stage" aria-label="PPE Guard AI introduction">
        <div className="login-stage-content">
          <span>Industrial safety intelligence</span>
          <h1>Safety.<br />Seen sooner.</h1>
          <p>
            ตรวจจับหมวกนิรภัยและเสื้อสะท้อนแสงแบบเรียลไทม์
            ด้วย Hybrid YOLOv8m + YOLO11n บน GPU ภายในองค์กร
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-[12px] font-semibold">
            <span className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 normal-case tracking-normal"><Cpu size={15} /> Edge GPU</span>
            <span className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 normal-case tracking-normal"><Activity size={15} /> Real-time alerts</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mb-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f3c8d4] bg-[#fff5f8] px-3 py-1.5">
              <Shield className="h-4 w-4 text-[#d7004d]" />
              <span className="text-[12px] font-bold text-[#9d174d]">PPE Guard AI</span>
            </div>
            <h2 className="mb-3 text-[36px] font-bold leading-tight tracking-[-0.045em] text-[#1d1d1f]">ยินดีต้อนรับ</h2>
            <p className="text-[15px] leading-6 text-[#6e6e73]">เข้าสู่ศูนย์ควบคุมความปลอดภัยด้วยบัญชีที่ผู้ดูแลระบบออกให้</p>
          </div>

          {error && (
            <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-[#f4c7cc] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#d70015]">
              <Shield className="h-4 w-4" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#424245]">
              <AtSign className="h-4 w-4" /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              autoComplete="username"
              required
              className="mb-6 h-14 w-full rounded-xl border border-[#d2d2d7] bg-[#fbfbfd] px-4 text-[15px] text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:bg-white"
            />

            <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#424245]">
              <Lock className="h-4 w-4" /> Password
            </label>
            <div className="relative mb-8">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="h-14 w-full rounded-xl border border-[#d2d2d7] bg-[#fbfbfd] px-4 pr-12 text-[15px] text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-4 top-1/2 -translate-y-1/2 border-0 bg-transparent text-[#86868b]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <button type="submit" disabled={isLoading} className="btn-apple-primary min-h-12 w-full text-[15px]">
              {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> กำลังเข้าสู่ระบบ…</> : <>เข้าสู่ Dashboard <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] leading-5 text-[#86868b]">
            ระบบนี้จำกัดเฉพาะผู้ใช้งานที่ได้รับอนุญาตและมีการบันทึกกิจกรรมเพื่อความปลอดภัย
          </p>
        </div>
      </section>
    </div>
  )
}
