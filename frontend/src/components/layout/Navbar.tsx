import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { LogOut, Shield, Home, Upload, History, Bell } from 'lucide-react'

export function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="min-h-11 bg-black text-white" aria-label="Primary navigation">
      <div className="mx-auto max-w-[1440px] px-5">
        <div className="flex min-h-11 items-center justify-between gap-6">
          <Link to="/" className="flex min-h-11 items-center gap-2 text-white no-underline">
            <Shield className="h-5 w-5" />
            <span className="text-[14px] font-semibold tracking-[-0.02em]">PPE Guard AI</span>
          </Link>

          <div className="flex items-center gap-5 text-[12px]">
            <Link to="/" className="flex min-h-11 items-center gap-1.5 text-[#d1d1d6] no-underline">
              <Home className="h-4 w-4" />
              <span>หน้าหลัก</span>
            </Link>
            <Link to="/detection" className="flex min-h-11 items-center gap-1.5 text-[#d1d1d6] no-underline">
              <Upload className="h-4 w-4" />
              <span>ตรวจจับ</span>
            </Link>
            <Link to="/reports" className="flex min-h-11 items-center gap-1.5 text-[#d1d1d6] no-underline">
              <History className="h-4 w-4" />
              <span>ประวัติ</span>
            </Link>
            <Link to="/alerts" className="flex min-h-11 items-center gap-1.5 text-[#d1d1d6] no-underline">
              <Bell className="h-4 w-4" />
              <span>แจ้งเตือน</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 text-[12px]">
            <span className="hidden text-[#a1a1a6] lg:inline">{user?.full_name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-11 items-center gap-1.5 rounded-full border-0 bg-[#272729] px-4 text-white"
            >
              <LogOut className="h-4 w-4" />
              <span>ออก</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
