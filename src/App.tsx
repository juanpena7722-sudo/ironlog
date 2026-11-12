import { Suspense, lazy } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { errorMessage, useLogout, useSession } from './api/auth'
import LocalDataBanner from './components/LocalDataBanner'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Workouts = lazy(() => import('./pages/Workouts'))
const Diet = lazy(() => import('./pages/Diet'))
const Progress = lazy(() => import('./pages/Progress'))
const Health = lazy(() => import('./pages/Health'))
const Settings = lazy(() => import('./pages/Settings'))
const Auth = lazy(() => import('./pages/Auth'))

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◎' },
  { to: '/workouts', label: 'Workouts', icon: '🏋️' },
  { to: '/diet', label: 'Diet', icon: '🍗' },
  { to: '/progress', label: 'Progress', icon: '📈' },
  { to: '/health', label: 'Health', icon: '❤️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

const LOADING = <p className="muted">Loading…</p>

function ProtectedShell() {
  const location = useLocation()
  const session = useSession()
  const logout = useLogout()

  if (session.isPending) return LOADING
  if (session.isError) {
    return (
      <main className="auth">
        <p role="alert">Could not check your session.</p>
        <button type="button" onClick={() => session.refetch()}>
          Retry
        </button>
      </main>
    )
  }
  if (!session.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">
          Iron<span>Log</span>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link">
            <span className="nav-icon" aria-hidden>
              {n.icon}
            </span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="nav-link"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <span className="nav-icon" aria-hidden>
            ⎋
          </span>
          <span className="nav-label">Log out</span>
        </button>
      </nav>
      <main className="main">
        {logout.error && (
          <p role="alert" className="field-error">
            {errorMessage(logout.error)}
          </p>
        )}
        <LocalDataBanner />
        <Suspense fallback={LOADING}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={LOADING}>
      <Routes>
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/diet" element={<Diet />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/health" element={<Health />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
