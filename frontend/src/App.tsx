import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { authService } from './services/auth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DetectionPage } from './pages/DetectionPage'
import { CameraPage } from './pages/CameraPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { AlertsPage } from './pages/AlertsPage'

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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/detection" element={<PrivateRoute><DetectionPage /></PrivateRoute>} />
        <Route path="/camera" element={<PrivateRoute><CameraPage /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
        <Route path="/alerts" element={<PrivateRoute><AlertsPage /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      </Routes>
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
