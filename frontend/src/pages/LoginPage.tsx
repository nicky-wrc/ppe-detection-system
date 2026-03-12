import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authService } from '../services/auth'
import { Shield, Mail, Lock, Loader2, Info } from 'lucide-react'
import toast from 'react-hot-toast'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    } catch (err) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-slate-50 overflow-hidden">
      {/* Left Panel - Branding (Hidden on small screens) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 relative items-center justify-center p-12 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500 blur-[100px]"></div>
        </div>
        
        <div className="relative z-10 max-w-lg text-white">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20 shadow-xl">
            <Shield className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            ระบบตรวจจับ<br />
            <span className="text-blue-400">อุปกรณ์ความปลอดภัย</span><br />
            ด้วย AI อัจฉริยะ
          </h1>
          <p className="text-lg text-blue-100/80 leading-relaxed mb-12 max-w-md">
            ยกระดับความปลอดภัยในพื้นที่ทำงานของคุณ ด้วยเทคโนโลยีคอมพิวเตอร์วิทัศน์ที่ช่วยวิเคราะห์และแจ้งเตือนการฝ่าฝืนแบบเรียลไทม์
          </p>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 p-6 rounded-2xl flex items-start gap-4 shadow-lg">
             <Info className="w-6 h-6 text-blue-300 shrink-0 mt-1" />
             <div>
               <h3 className="font-bold text-white mb-1">เทคโนโลยีล่าสุด</h3>
               <p className="text-blue-200 text-sm leading-relaxed">ประมวลผลรวดเร็วและแม่นยำ รองรับการตรวจจับหมวกนิรภัย เสื้อสะท้อนแสง และแว่นตา ครอบคลุมทุกพื้นที่เสี่ยง</p>
             </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative h-screen overflow-y-auto">
        {/* Mobile Header (Visible only on small screens) */}
        <div className="absolute top-8 left-6 sm:left-12 lg:hidden flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg">PPE System</span>
        </div>

        <div className="w-full max-w-md">
          <div className="text-center lg:text-left mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">ยินดีต้อนรับกลับมา</h2>
            <p className="text-slate-500">กรุณาเข้าสู่ระบบเพื่อเข้าใช้งาน Dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <Shield className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 ml-1">อีเมล</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ppe-system.com"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm sm:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-bold text-slate-700">รหัสผ่าน</label>
                <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                  ลืมรหัสผ่าน?
                </a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm sm:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm sm:text-base font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all relative overflow-hidden group"
            >
              <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none"></span>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังตรวจสอบข้อมูล...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  เข้าสู่ระบบ
                </span>
              )}
            </button>
          </form>

          {/* Demo Account info */}
          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-blue-200 transition-colors">
              <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span>🔑</span> บัญชีสำหรับทดสอบ (Demo)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">EMAIL</p>
                  <p className="text-sm font-mono text-slate-700 bg-white px-2 py-1 rounded border border-slate-100">admin@ppe-system.com</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">PASSWORD</p>
                  <p className="text-sm font-mono text-slate-700 bg-white px-2 py-1 rounded border border-slate-100">admin123</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

