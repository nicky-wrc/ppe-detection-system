import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { authService } from './services/auth'
import { LoginPage } from './pages/LoginPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const DetectionPage = lazy(() => import('./pages/DetectionPage').then((module) => ({ default: module.DetectionPage })))
const CameraPage = lazy(() => import('./pages/CameraPage').then((module) => ({ default: module.CameraPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const AlertsPage = lazy(() => import('./pages/AlertsPage').then((module) => ({ default: module.AlertsPage })))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })))

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
  if (bootstrapping) return null
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">Loading...</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/detection" element={<PrivateRoute><DetectionPage /></PrivateRoute>} />
          <Route path="/camera" element={<PrivateRoute><CameraPage /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
          <Route path="/alerts" element={<PrivateRoute><AlertsPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
          },
        }}
      />
    </BrowserRouter>
  )
}

export default App
