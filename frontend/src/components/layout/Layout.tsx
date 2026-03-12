import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  Shield,
  Bell,
  User,
  LogOut,
  LayoutDashboard,
  Camera,
  FileText,
  Settings,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/detection', icon: Camera, label: 'Detection' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
    setIsUserMenuOpen(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="flex-shrink-0 h-16 flex items-center justify-between px-6 lg:px-10 z-20 border-b border-[#1e293b]/50" style={{ backgroundColor: '#0f1724' }}>
        <div className="flex items-center gap-10">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#06b6d4]/20">
              <Shield className="w-6 h-6 text-[#06b6d4]" />
            </div>
            <span className="font-bold text-white text-xl tracking-tight">
              PPE Guard AI
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? 'text-[#06b6d4] bg-[#06b6d4]/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <button
            className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-6 h-6" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0f1724]" />
          </button>

          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#06b6d4] to-[#0891b2] flex items-center justify-center">
                {user?.full_name ? (
                  <span className="text-base font-bold text-white">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <span className="hidden sm:block text-base font-medium text-slate-300">
                {user?.full_name || 'User'}
              </span>
            </button>

            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 py-2 rounded-xl shadow-xl z-20 border border-[#1e293b]" style={{ backgroundColor: '#1e293b' }}>
                  <div className="px-4 py-3 border-b border-slate-700/50">
                    <p className="text-sm font-medium text-white">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{user?.email || ''}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-base text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-10 overflow-y-auto" style={{ backgroundColor: '#0f1724' }}>
          <nav className="flex flex-col p-5 gap-2">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-xl text-lg font-medium transition-colors ${
                    isActive
                      ? 'text-[#06b6d4] bg-[#06b6d4]/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#0a0e17' }}>
        <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-10 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 h-10 flex items-center justify-between px-6 lg:px-10 text-xs font-medium border-t border-[#1e293b]/50" style={{ backgroundColor: '#0f1724' }}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400">AI CORE: OPERATIONAL</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-400">NETWORK: STABLE</span>
          </div>
        </div>
        <span className="text-slate-500 hidden sm:block">LAST UPDATED: {new Date().toLocaleTimeString()}</span>
      </footer>
    </div>
  )
}
