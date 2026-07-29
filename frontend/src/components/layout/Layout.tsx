import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  Camera,
  FileText,
  LayoutDashboard,
  LogOut,
  ScanLine,
  Settings,
  Shield,
  User,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { camerasService } from '../../services/cameras'
import { settingsService } from '../../services/settings'
import { useAuthStore } from '../../stores/authStore'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Overview' },
  { path: '/detection', icon: Camera, label: 'Detect' },
  { path: '/camera', icon: ScanLine, label: 'Cameras' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [alertSound, setAlertSound] = useState(false)
  const visibleNavItems = user?.role === 'admin'
    ? [...navItems, { path: '/admin/users', icon: Users, label: 'Users' }]
    : navItems

  useEffect(() => {
    if (!user) return
    void settingsService.getMe().then((value) => setAlertSound(value.alert_sound)).catch(() => undefined)
  }, [user])

  useEffect(() => {
    if (!user) return
    const socket = camerasService.connect('alerts', (raw) => {
      const message = raw as { type?: string; data?: { camera_name?: string; violation_type?: string } }
      if (message.type !== 'alert') return
      if (alertSound) {
        try {
          const context = new window.AudioContext()
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          oscillator.frequency.value = 880
          gain.gain.value = 0.08
          oscillator.connect(gain)
          gain.connect(context.destination)
          oscillator.start()
          oscillator.stop(context.currentTime + 0.18)
          oscillator.onended = () => void context.close()
        } catch {
          // The visual notification remains available when a browser blocks audio.
        }
      }
      toast.error(
        `PPE violation · ${message.data?.camera_name || 'Unknown camera'} · ${message.data?.violation_type || 'Unknown type'}`,
        { duration: 6000 },
      )
    })
    return () => socket?.close()
  }, [alertSound, user])

  const handleLogout = () => {
    logout()
    setIsUserMenuOpen(false)
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand" aria-label="PPE Guard AI overview">
          <span className="brand-mark"><Shield size={20} /></span>
          <span className="brand-copy">
            <strong>PPE Guard AI</strong>
            <small>Safety intelligence</small>
          </span>
        </Link>

        <nav className="app-nav" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`app-nav-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon size={16} strokeWidth={2.2} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="header-actions">
          <span className="system-pill"><i /> AI online</span>
          <div className="profile-menu">
            <button
              type="button"
              className="profile-button"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              aria-label="Open account menu"
              aria-expanded={isUserMenuOpen}
            >
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User size={17} />}
            </button>
            {isUserMenuOpen && (
              <>
                <button className="profile-dismiss" aria-label="Close account menu" onClick={() => setIsUserMenuOpen(false)} />
                <div className="profile-popover">
                  <div>
                    <strong>{user?.full_name || 'User'}</strong>
                    <span>{user?.email || ''}</span>
                    <small>{user?.role?.replace('_', ' ')}</small>
                  </div>
                  <button type="button" onClick={handleLogout}><LogOut size={15} /> ออกจากระบบ</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>

      <footer className="app-footer">
        <span><i /> AI core operational</span>
        <span>Hybrid YOLOv8m + YOLO11n</span>
      </footer>
    </div>
  )
}
