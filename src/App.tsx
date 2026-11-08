import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Workouts from './pages/Workouts'
import Diet from './pages/Diet'
import Progress from './pages/Progress'
import Health from './pages/Health'
import Settings from './pages/Settings'

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
            <span className="nav-icon" aria-hidden>{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/diet" element={<Diet />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/health" element={<Health />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
