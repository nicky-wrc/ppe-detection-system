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
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="w-8 h-8" />
            <span className="text-xl font-bold">PPE Detection</span>
          </Link>

          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-1 hover:text-blue-200">
              <Home className="w-5 h-5" />
              <span>หน้าหลัก</span>
            </Link>
            <Link to="/detect" className="flex items-center space-x-1 hover:text-blue-200">
              <Upload className="w-5 h-5" />
              <span>ตรวจจับ</span>
            </Link>
            <Link to="/history" className="flex items-center space-x-1 hover:text-blue-200">
              <History className="w-5 h-5" />
              <span>ประวัติ</span>
            </Link>
            <Link to="/alerts" className="flex items-center space-x-1 hover:text-blue-200">
              <Bell className="w-5 h-5" />
              <span>แจ้งเตือน</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm">{user?.full_name}</span>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 hover:text-blue-200"
            >
              <LogOut className="w-5 h-5" />
              <span>ออก</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}