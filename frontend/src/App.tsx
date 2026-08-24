import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { useAuthStore } from './stores/authStore'
import { authService } from './services/auth'
import { LoginPage } from './pages/LoginPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const DetectionPage = lazy(() => import('./pages/DetectionPage').then((module) => ({ default: module.DetectionPage })))
const CameraPage = lazy(() => import('./pages/CameraPage').then((module) => ({ default: module.CameraPage })))
const SafetyCenterPage = lazy(() => import('./pages/SafetyCenterPage').then((module) => ({ default: module.SafetyCenterPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })))

function AppLoading({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div className="route-loader" role="status" aria-live="polite">
      <div>
        <span className="route-loader-mark"><Shield size={21} /></span>
        <span>{label}</span>
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, setUser, logout } = useAuthStore()
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      if (!isAuthenticated) {
        if (mounted) setBootstrapping(false)
        return
      }
      if (user) {
        if (mounted) setBootstrapping(false)
        return
      }
      try {
        const me = await authService.getMe()
        if (mounted) setUser(me)
      } catch {
        logout()
      } finally {
        if (mounted) setBootstrapping(false)
      }
    }
    bootstrap()
    return () => {
      mounted = false
    }
  }, [isAuthenticated, user, setUser, logout])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (bootstrapping) return <AppLoading label="Securing your workspace…" />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<AppLoading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/detection" element={<PrivateRoute><DetectionPage /></PrivateRoute>} />
          <Route path="/camera" element={<PrivateRoute><CameraPage /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><SafetyCenterPage /></PrivateRoute>} />
          <Route path="/alerts" element={<PrivateRoute><SafetyCenterPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute><AdminRoute><AdminUsersPage /></AdminRoute></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(255, 255, 255, 0.96)',
            color: '#1d1d1f',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '18px',
            boxShadow: 'none',
            fontSize: '14px',
          },
        }}
      />
    </BrowserRouter>
  )
}

export default App
