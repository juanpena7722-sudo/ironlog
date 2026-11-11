import { Suspense, lazy } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Workouts = lazy(() => import('./pages/Workouts'))
const Diet = lazy(() => import('./pages/Diet'))
const Progress = lazy(() => import('./pages/Progress'))
const Health = lazy(() => import('./pages/Health'))
const Settings = lazy(() => import('./pages/Settings'))

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◎' },
  { to: '/workouts', label: 'Workouts', icon: '🏋️' },
  { to: '/diet', label: 'Diet', icon: '🍗' },
  { to: '/progress', label: 'Progress', icon: '📈' },
  { to: '/health', label: 'Health', icon: '❤️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
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
      </nav>
      <main className="main">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/diet" element={<Diet />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/health" element={<Health />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
