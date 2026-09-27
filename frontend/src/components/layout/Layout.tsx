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
import { useLanguage } from '../../i18n/LanguageContext'

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
  { path: '/reports', icon: FileText, label: 'Reports', description: 'Evidence, history and safety review' },
  { path: '/settings', icon: Settings, label: 'Settings', description: 'Detection preferences', roles: ['admin', 'safety_officer'] },
]

export function Layout({ children }: LayoutProps) {
  const { language, setLanguage, text } = useLanguage()
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
  const navText: Record<string, { th: string; en: string; descriptionTh: string }> = {
    '/': { th: 'ภาพรวม', en: 'Overview', descriptionTh: 'ภาพรวมความปลอดภัย' },
    '/detect': { th: 'ตรวจจับ', en: 'Detect', descriptionTh: 'ติดตามกล้องหน้างาน' },
    '/reports': { th: 'รายงาน', en: 'Reports', descriptionTh: 'ประวัติและหลักฐาน' },
    '/settings': { th: 'ตั้งค่า', en: 'Settings', descriptionTh: 'ตั้งค่าการตรวจจับ' },
    '/admin/users': { th: 'ผู้ใช้', en: 'Users', descriptionTh: 'จัดการสิทธิ์ผู้ใช้' },
  }
  const localizedNav = (item: NavItem) => navText[item.path]

  useEffect(() => {
    if (!user) return
    return settingsService.subscribe(user.id, (value) => setAlertSound(value.alert_sound), () => {
      toast.error(text('โหลดค่าเสียงเตือนไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ', 'Unable to load alert sound settings. Check the connection.'), { id: 'settings-sync-error' })
    })
  }, [text, user])

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
            <small>{text('ระบบความปลอดภัย', 'Edge safety')}</small>
          </span>
        </Link>

        <button
          type="button"
          className="mobile-nav-button"
          onClick={() => setIsMobileNavOpen((open) => !open)}
          aria-label={isMobileNavOpen ? text('ปิดเมนู', 'Close navigation') : text('เปิดเมนู', 'Open navigation')}
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
                <span>{language === 'th' ? localizedNav(item)?.th ?? item.label : localizedNav(item)?.en ?? item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="header-actions">
          <span className="system-pill"><i /> {text('AI พร้อมใช้งาน', 'AI online')}</span>
          <div className="language-switch" role="group" aria-label={text('เลือกภาษา', 'Choose language')}>
            <button type="button" onClick={() => setLanguage('th')} className={language === 'th' ? 'is-active' : ''} aria-pressed={language === 'th'}>ไทย</button>
            <button type="button" onClick={() => setLanguage('en')} className={language === 'en' ? 'is-active' : ''} aria-pressed={language === 'en'}>EN</button>
          </div>
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
                  <button type="button" onClick={handleLogout}><LogOut size={15} /> {text('ออกจากระบบ', 'Sign out')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>

      <footer className="app-footer" aria-label="PPE Detection System footer">
        <div className="app-footer-inner">
          <div className="app-footer-brand">
            <span className="app-footer-mark" aria-hidden="true"><Shield size={18} strokeWidth={1.8} /></span>
            <span className="app-footer-copy">
              <strong>PPE Detection System</strong>
              <small>{text('ตรวจจับความปลอดภัยโดยคำนึงถึงความเป็นส่วนตัว', 'Privacy-aware edge safety monitoring')}</small>
            </span>
          </div>

          <div className="app-footer-creators">
            <span>{text('สร้างโดย', 'Created by')}</span>
            <strong>Nicky</strong>
            <span>{text('และ', 'and')}</span>
            <strong>Krit</strong>
          </div>

        </div>
      </footer>
    </div>
  )
}
