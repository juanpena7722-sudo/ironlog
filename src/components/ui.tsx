import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Meter({
  label,
  value,
  goal,
  unit = '',
}: {
  label: string
  value: number
  goal: number
  unit?: string
}) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const over = goal > 0 && value > goal * 1.05
  return (
    <div className="meter">
      <div className="meter-row">
        <span>{label}</span>
        <span className="muted">
          <strong className={over ? 'warn' : ''}>{Math.round(value)}</strong> / {goal}
          {unit}
        </span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {sub && <p className="muted">{sub}</p>}
    </div>
  )
}

export function Field({
  label,
  error,
  ...input
}: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const errorId = useId()
  return (
    <div className="field">
      <label>
        {label}
        <input
          {...input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </label>
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

export const chart = {
  grid: 'var(--border)',
  axis: { fontSize: 12, fill: 'var(--muted)' },
  primary: '#f97316',
  secondary: '#38bdf8',
  tertiary: '#a3e635',
  tooltip: {
    contentStyle: {
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      color: 'var(--text)',
    },
    labelStyle: { color: 'var(--muted)' },
  },
}
