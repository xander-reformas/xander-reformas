import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import ForgotPasswordPage from './components/auth/ForgotPasswordPage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
import OnboardingWizard from './components/onboarding/OnboardingWizard'
import Dashboard from './components/dashboard/Dashboard'
import LandingPage from './components/landing/LandingPage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-arena flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl font-black text-navy mb-1">
          <span className="text-gold">X</span>ANDER
        </div>
        <div className="text-xs tracking-widest text-stone mt-1">Cargando...</div>
        <div className="mt-4 w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}

export default function App() {
  const { profile } = useAuth()

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={
        <PublicRoute><LoginPage /></PublicRoute>
      } />
      <Route path="/registro" element={
        <PublicRoute><RegisterPage /></PublicRoute>
      } />
      <Route path="/recuperar-password" element={
        <PublicRoute><ForgotPasswordPage /></PublicRoute>
      } />
      {/* reset-password NO usa PublicRoute: el usuario llega desde el email sin sesión activa */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/onboarding" element={
        <PrivateRoute><OnboardingWizard /></PrivateRoute>
      } />
      <Route path="/dashboard/*" element={
        <PrivateRoute>
          {profile && !profile.onboarding_completado
            ? <Navigate to="/onboarding" replace />
            : <Dashboard />
          }
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
