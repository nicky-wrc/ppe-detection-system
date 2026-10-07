import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Activity, ArrowRight, AtSign, Cpu, Eye, EyeOff, Loader2, Lock, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

import { authService } from '../services/auth'
import { useAuthStore } from '../stores/authStore'
import { useLanguage } from '../i18n/LanguageContext'

export function LoginPage() {
  const isCloudDemo = import.meta.env.VITE_RESEARCH_DEMO === 'true'
  const { language, setLanguage, text } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { setToken, setUser, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    let tokenReceived = false
    try {
      const tokenData = await authService.login({ username: email, password })
      tokenReceived = true
      setToken(tokenData.access_token)
      setUser(await authService.getMe())
      toast.success(text('เข้าสู่ระบบสำเร็จ', 'Signed in successfully'))
      navigate('/')
    } catch (requestError) {
      logout()
      const isUnauthorized = axios.isAxiosError(requestError) && requestError.response?.status === 401
      setError(
        tokenReceived
          ? text('เข้าสู่ระบบแล้ว แต่โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาลองใหม่', 'Signed in, but account data could not be loaded. Please try again.')
          : isUnauthorized
            ? text('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'Incorrect email or password.')
            : text('เชื่อมต่อระบบยืนยันตัวตนไม่ได้ กรุณาตรวจสอบ backend แล้วลองใหม่', 'Unable to reach the authentication service. Check the backend and try again.'),
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-shell !bg-white">
      <section
        className="login-stage !items-stretch before:!hidden after:!hidden"
        style={{ background: '#272729' }}
        aria-labelledby="login-introduction-title"
      >
        <div
          className="login-stage-content flex min-h-full flex-col justify-between gap-16"
          style={{ padding: 0, background: 'transparent', backdropFilter: 'none' }}
        >
          <div>
            <div className="mb-8 flex items-center gap-3 text-[13px] font-semibold tracking-[0.04em] text-white/70 uppercase">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/15 bg-[#272729]">
                <Shield size={18} aria-hidden="true" />
              </div>
              PPE Detection System
            </div>
            <p className="!m-0 !max-w-none !text-[13px] font-semibold tracking-[0.08em] !text-white/55 uppercase">Industrial safety intelligence</p>
            <h1
              id="login-introduction-title"
              className="mt-5 max-w-[680px] text-[clamp(46px,7vw,88px)] font-semibold leading-[0.98] tracking-[-0.055em] text-white"
            >
              Safety.<br />Seen sooner.
            </h1>
            <p className="!mt-7 !max-w-[600px] text-[17px] font-normal !leading-[1.47] tracking-[-0.01em] !text-white/70">
              {isCloudDemo
                ? text('ทดลองตรวจจับหมวกนิรภัยและเสื้อสะท้อนแสงผ่าน Webcam ด้วย Hybrid YOLOv8m + YOLO11n ประมวลผลบนเซิร์ฟเวอร์ CPU', 'Test helmet and vest detection through your webcam with Hybrid YOLOv8m + YOLO11n on a CPU server.')
                : text('ตรวจจับหมวกนิรภัยและเสื้อสะท้อนแสงแบบเรียลไทม์ ด้วย Hybrid YOLOv8m + YOLO11n บน GPU ภายในองค์กร', 'Detect safety helmets and vests in real time with Hybrid YOLOv8m + YOLO11n on an on-premises GPU.')}
            </p>

            <div className="mt-10 grid max-w-[620px] gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-white/15 bg-[#272729] p-5">
                <Cpu className="mb-5 text-white/70" size={22} strokeWidth={1.75} aria-hidden="true" />
                <h2 className="m-0 text-[17px] font-semibold tracking-[-0.01em] text-white">{isCloudDemo ? 'Cloud research demo' : 'Edge processing'}</h2>
                <p className="!mt-1 !max-w-none !text-[14px] !leading-[1.47] !text-white/55">{isCloudDemo ? text('ส่งเฟรมที่ได้รับอนุญาตไปประมวลผลบนคลาวด์ ไม่รองรับ RTSP ภายในโรงงานโดยตรง', 'Authorized frames are processed in the cloud. Private factory RTSP is not directly supported.') : text('ประมวลผลบนโครงสร้างพื้นฐานภายในองค์กร', 'Processed on your organization’s infrastructure.')}</p>
              </div>
              <div className="rounded-[18px] border border-white/15 bg-[#272729] p-5">
                <Activity className="mb-5 text-white/70" size={22} strokeWidth={1.75} aria-hidden="true" />
                <h2 className="m-0 text-[17px] font-semibold tracking-[-0.01em] text-white">Real-time awareness</h2>
                <p className="!mt-1 !max-w-none !text-[14px] !leading-[1.47] !text-white/55">{text('แจ้งเตือนความเสี่ยงเพื่อให้ทีมตอบสนองได้เร็วขึ้น', 'Risk alerts help teams respond faster.')}</p>
              </div>
            </div>
          </div>

          <footer className="flex max-w-[620px] flex-col gap-3 border-t border-white/15 pt-6 text-white/60 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <p className="!m-0 !max-w-[430px] !text-[12px] !leading-[1.6] !text-inherit">
              {text('ระบบสนับสนุนการกำกับดูแลความปลอดภัย ไม่สามารถทดแทนขั้นตอนความปลอดภัยและการตรวจสอบโดยมนุษย์', 'This system supports safety oversight and does not replace safety procedures or human review.')}
            </p>
            <p className="!m-0 shrink-0 !text-[12px] !leading-[1.6] !text-white/75">
              Created by <strong className="font-semibold text-white">Nicky</strong> and <strong className="font-semibold text-white">Krit</strong>
            </p>
          </footer>
        </div>
      </section>

      <section className="login-panel !bg-[#f5f5f7]" aria-labelledby="login-form-title">
        <div className="login-card !rounded-[18px] !border-black/8 !p-6 sm:!p-10">
          <div className="mb-6 flex justify-end">
            <div className="inline-flex rounded-full border border-black/10 bg-white p-1" role="group" aria-label={text('เลือกภาษา', 'Choose language')}>
              {(['th', 'en'] as const).map((option) => (
                <button key={option} type="button" onClick={() => setLanguage(option)} aria-pressed={language === option} className={`min-h-9 rounded-full px-3 text-[12px] font-semibold ${language === option ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73]'}`}>{option === 'th' ? 'ไทย' : 'EN'}</button>
              ))}
            </div>
          </div>
          <div className="mb-9">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#f5f5f7] px-3.5 py-2">
              <Shield className="h-4 w-4 text-[#1d1d1f]" aria-hidden="true" />
              <span className="text-[12px] font-semibold tracking-[0.02em] text-[#424245]">PPE Detection System</span>
            </div>
            <h2 id="login-form-title" className="mb-3 text-[clamp(34px,4vw,42px)] font-semibold leading-[1.08] tracking-[-0.035em] text-[#1d1d1f]">{text('ยินดีต้อนรับ', 'Welcome')}</h2>
            <p className="text-[17px] font-normal leading-[1.47] tracking-[-0.01em] text-[#6e6e73]">{text('เข้าสู่ระบบด้วยบัญชีที่ผู้ดูแลสร้างให้', 'Sign in with an account provided by your administrator.')}</p>
          </div>

          {error && (
            <div id="login-error" role="alert" aria-live="assertive" className="mb-6 flex items-start gap-3 rounded-[11px] border border-[#f2b8bd] bg-[#fff5f5] px-4 py-3 text-[14px] leading-[1.47] text-[#d70015]">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} aria-busy={isLoading}>
            <label htmlFor="login-email" className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#424245]">
              <AtSign className="h-4 w-4 text-[#86868b]" aria-hidden="true" /> {text('อีเมล', 'Email')}
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              autoComplete="username"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              className="mb-6 h-14 w-full rounded-[11px] border border-[#d2d2d7] bg-white px-4 text-[17px] font-normal text-[#1d1d1f] outline-none transition placeholder:text-[var(--muted)] focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20"
            />

            <label htmlFor="login-password" className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#424245]">
              <Lock className="h-4 w-4 text-[#86868b]" aria-hidden="true" /> {text('รหัสผ่าน', 'Password')}
            </label>
            <div className="relative mb-8">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                className="h-14 w-full rounded-[11px] border border-[#d2d2d7] bg-white px-4 pr-14 text-[17px] font-normal text-[#1d1d1f] outline-none transition placeholder:text-[var(--muted)] focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[#0066cc] transition active:scale-95"
                aria-label={showPassword ? text('ซ่อนรหัสผ่าน', 'Hide password') : text('แสดงรหัสผ่าน', 'Show password')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>

            <button type="submit" disabled={isLoading} className="btn-apple-primary min-h-12 w-full px-6 text-[17px]">
              {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {text('กำลังเข้าสู่ระบบ…', 'Signing in…')}</> : <>{text('เข้าสู่ระบบ', 'Sign in')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
            </button>
          </form>

          <p className="mt-7 text-center text-[12px] leading-[1.6] text-[var(--muted)]">
            {text('สำหรับผู้ที่ได้รับอนุญาตเท่านั้น ระบบจะบันทึกกิจกรรมเพื่อความปลอดภัย', 'Authorized users only. Activity is logged for security.')}
          </p>
        </div>
      </section>
    </main>
  )
}
