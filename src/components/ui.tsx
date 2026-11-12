import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { errorMessage } from '../api/auth'

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

type QueryLike = { isPending: boolean; error: Error | null; refetch: () => unknown }

/** Shows loading or an error with retry until every query has data, then the children. */
export function QueryState({ queries, children }: { queries: QueryLike[]; children?: ReactNode }) {
  const failed = queries.filter((q) => q.error)
  const error = failed[0]?.error
  if (error) {
    return (
      <div className="query-error">
        <p role="alert">Could not load your data. {errorMessage(error)}</p>
        <button type="button" onClick={() => failed.forEach((q) => q.refetch())}>
          Retry
        </button>
      </div>
    )
  }
  if (queries.some((q) => q.isPending)) {
    return (
      <p role="status" className="muted">
        Loading…
      </p>
    )
  }
  return children
}

type MutationLike = { isSuccess: boolean; error: Error | null; submittedAt: number }

/** Announces the result of the most recent of the given mutations. */
export function MutationFeedback({ mutations }: { mutations: [MutationLike, string][] }) {
  const [mutation, success] = mutations.reduce(
    (latest, item) => (item[0].submittedAt > latest[0].submittedAt ? item : latest),
    mutations[0],
  )
  return (
    <>
      <p role="status" className="toast">
        {mutation.isSuccess ? success : ''}
      </p>
      {mutation.error && (
        <p role="alert" className="toast error">
          {errorMessage(mutation.error)}
        </p>
      )}
    </>
  )
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
