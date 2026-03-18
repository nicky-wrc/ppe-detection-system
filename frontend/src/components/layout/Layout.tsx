import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Shield, Bell, User, LogOut, Camera, FileText, LayoutDashboard, Menu, X, Settings } from 'lucide-react'
import { useState } from 'react'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/detection', icon: Camera, label: 'Detection' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f0f4f8' }}>

      {/* ── Navbar ── */}
      <header style={{
        flexShrink: 0,
        height: '60px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5eaf0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '32px',
        paddingRight: '32px',
        zIndex: 20,
        position: 'relative',
      }}>

        {/* Left: Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '38px', height: '38px',
            backgroundColor: '#2563eb',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={20} color="#ffffff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '17px', color: '#0f172a', letterSpacing: '-0.3px' }}>
            PPE Guard AI
          </span>
        </Link>

        {/* Center: Nav links — absolutely centered */}
        <nav style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 14px 4px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#2563eb' : '#64748b',
                  textDecoration: 'none',
                  borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                  transition: 'color 0.15s',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right: Bell + Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          {/* Bell */}
          <button
            aria-label="Notifications"
            onClick={() => navigate('/alerts')}
            style={{
              position: 'relative',
              width: '36px', height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b',
            }}
          >
            <Bell size={19} />
          </button>

          {/* User avatar */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              style={{
                width: '36px', height: '36px',
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {user?.full_name ? (
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User size={17} color="#ffffff" />
              )}
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div style={{
                  position: 'absolute', right: 0, top: '44px',
                  width: '200px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5eaf0',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 20,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{user?.full_name || 'User'}</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>{user?.email || ''}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '10px 16px',
                      fontSize: '13px', color: '#ef4444',
                      background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <LogOut size={15} />
                    ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              display: 'none', // hidden on desktop – shown via media query below (not needed here as inline)
              width: '36px', height: '36px',
              borderRadius: '8px', border: 'none',
              background: 'none', cursor: 'pointer',
              color: '#64748b',
            }}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {isMobileMenuOpen && (
        <div style={{
          position: 'fixed', top: '60px', left: 0, right: 0, bottom: 0,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5eaf0',
          zIndex: 10,
          overflowY: 'auto',
        }}>
          <nav style={{ display: 'flex', flexDirection: 'column', padding: '12px', gap: '4px' }}>
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: isActive ? '#2563eb' : '#64748b',
                    backgroundColor: isActive ? '#eff6ff' : 'transparent',
                    textDecoration: 'none',
                  }}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f0f4f8' }}>
        <div style={{
          width: '100%',
          maxWidth: '1280px',
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingLeft: '40px',
          paddingRight: '40px',
          paddingTop: '32px',
          paddingBottom: '32px',
        }}>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        flexShrink: 0,
        height: '40px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5eaf0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '32px',
        paddingRight: '32px',
      }}>
      </footer>
    </div>
  )
}
