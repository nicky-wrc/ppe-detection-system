import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  // Camera,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Settings,
  Shield,
  User,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { camerasService } from '../../services/cameras'
import { settingsService } from '../../services/settings'
import { useAuthStore } from '../../stores/authStore'
import type { UserRole } from '../../types'

interface LayoutProps {
  children: React.ReactNode
}

interface NavItem {
  path: string
  icon: typeof LayoutDashboard
  label: string
  description: string
  roles?: readonly UserRole[]
}

const navItems: NavItem[] = [
  { path: '/', icon: LayoutDashboard, label: 'Overview', description: 'Safety intelligence' },
  // Detect page is temporarily hidden; uncomment this item to restore it.
  // { path: '/detection', icon: Camera, label: 'Detect', description: 'Analyze PPE media' },
  { path: '/detect', icon: ScanLine, label: 'Detect', description: 'Live edge monitoring', roles: ['admin', 'safety_officer'] },
  { path: '/reports', icon: FileText, label: 'Reports & Alerts', description: 'Evidence, history and safety review' },
  { path: '/settings', icon: Settings, label: 'Settings', description: 'Detection preferences', roles: ['admin', 'safety_officer'] },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [alertSound, setAlertSound] = useState(false)
  const roleVisibleNavItems = navItems.filter((item) => (
    !item.roles || (user ? item.roles.includes(user.role) : false)
  ))
  const visibleNavItems: NavItem[] = user?.role === 'admin'
    ? [...roleVisibleNavItems, { path: '/admin/users', icon: Users, label: 'Users', description: 'Access management' }]
    : roleVisibleNavItems
  const isNavItemActive = (path: string) => (
    location.pathname === path
    || (path !== '/' && location.pathname.startsWith(path))
    || (path === '/reports' && location.pathname.startsWith('/alerts'))
  )
  const activeNavItem = visibleNavItems.find((item) => (
    isNavItemActive(item.path)
  )) ?? visibleNavItems[0]

  useEffect(() => {
    if (!user) return
    void settingsService.getMe().then((value) => setAlertSound(value.alert_sound)).catch(() => undefined)
  }, [user])

  useEffect(() => {
    const handleSettingsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ alertSound?: boolean }>).detail
      if (typeof detail?.alertSound === 'boolean') setAlertSound(detail.alertSound)
    }
    window.addEventListener('ppe:settings-updated', handleSettingsUpdate)
    return () => window.removeEventListener('ppe:settings-updated', handleSettingsUpdate)
  }, [])

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
        <Link to="/" className="brand" aria-label="PPE Detection System overview">
          <span className="brand-mark"><Shield size={20} /></span>
          <span className="brand-copy">
            <strong>PPE Detection System</strong>
            <small>Edge safety</small>
          </span>
        </Link>

        <button
          type="button"
          className="mobile-nav-button"
          onClick={() => setIsMobileNavOpen((open) => !open)}
          aria-label={isMobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isMobileNavOpen}
          aria-controls="primary-navigation"
        >
          {isMobileNavOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <nav id="primary-navigation" className={`app-nav${isMobileNavOpen ? ' is-open' : ''}`} aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const isActive = isNavItemActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`app-nav-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  setIsMobileNavOpen(false)
                  setIsUserMenuOpen(false)
                }}
              >
                <item.icon size={15} strokeWidth={2} />
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
                <button type="button" className="profile-dismiss" aria-label="Close account menu" onClick={() => setIsUserMenuOpen(false)} />
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

      <div className="app-subnav">
        <div className="app-subnav-inner">
          <span className="app-subnav-title">{activeNavItem.label}</span>
          <span className="app-subnav-meta">{activeNavItem.description} · {user?.role?.replace('_', ' ') || 'workspace'}</span>
        </div>
      </div>

      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>

      <footer className="app-footer" aria-label="PPE Detection System footer">
        <div className="app-footer-inner">
          <div className="app-footer-brand">
            <span className="app-footer-mark" aria-hidden="true"><Shield size={18} strokeWidth={1.8} /></span>
            <span className="app-footer-copy">
              <strong>PPE Detection System</strong>
              <small>Privacy-aware edge safety monitoring</small>
            </span>
          </div>

          <div className="app-footer-creators">
            <span>Created by</span>
            <strong>Nicky</strong>
            <span>and</span>
            <strong>Krit</strong>
          </div>

          <div className="app-footer-note">
            <span>Hybrid YOLOv8m + YOLO11n</span>
            <span>Safety-support system · Human review required</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
