import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DEFAULT_GOALS, useBody, useDeleteBody, useGoals, useSaveBody } from '../store'
import type { BodyEntry } from '../types'
import { Card, Empty, MutationFeedback, PageHead, QueryState, Stat, chart } from '../components/ui'
import { byDateAsc, byDateDesc, daysAgo, fmtDate, num, today, uid } from '../utils'
import { fromDisplayLength, fromDisplayWeight, toDisplayLength, toDisplayWeight } from '../units'

const FIELDS = [
  ['bodyFat', 'Body fat %'],
  ['chest', 'Chest'],
  ['waist', 'Waist'],
  ['arms', 'Arms'],
  ['thighs', 'Thighs'],
] as const

const NO_ENTRIES: BodyEntry[] = []

type Metric = 'weight' | (typeof FIELDS)[number][0]
type Form = Record<'date' | Metric, string>
const emptyForm = (): Form => ({
  date: today(),
  weight: '',
  bodyFat: '',
  chest: '',
  waist: '',
  arms: '',
  thighs: '',
})

export default function Progress() {
  const bodyQuery = useBody()
  const goalsQuery = useGoals()
  const entries = bodyQuery.data ?? NO_ENTRIES
  const { unit, targetWeight } = goalsQuery.data ?? DEFAULT_GOALS
  const saveBody = useSaveBody()
  const deleteBody = useDeleteBody()
  const lenUnit = unit === 'kg' ? 'cm' : 'in'
  const [form, setForm] = useState<Form>(emptyForm)
  const [metric, setMetric] = useState<Metric>('weight')
  const weight = (kg: number) => toDisplayWeight(kg, unit)
  const show = (k: Metric, value: number) =>
    k === 'weight' ? weight(value) : k === 'bodyFat' ? value : toDisplayLength(value, unit)

  const asc = useMemo(() => [...entries].sort(byDateAsc), [entries])
  const latest = asc.at(-1)

  const weekAvg = (from: number, to: number) => {
    const xs = asc
      .filter((b) => b.date > daysAgo(to) && b.date <= daysAgo(from))
      .map((b) => b.weight)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined
  }
  const thisWeek = weekAvg(0, 7)
  const lastWeek = weekAvg(7, 14)
  const monthAgo = [...asc].reverse().find((b) => b.date <= daysAgo(30))

  const series = asc
    .filter((b) => b[metric] !== undefined)
    .map((b) => ({ label: fmtDate(b.date), value: show(metric, b[metric] as number) }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = num(form.weight)
    if (value === undefined) return
    // One entry per day: replace any existing entry with the same date.
    const existing = entries.find((b) => b.date === form.date)
    const entry: BodyEntry = {
      id: existing?.id ?? uid(),
      date: form.date,
      weight: fromDisplayWeight(value, unit),
    }
    FIELDS.forEach(([k]) => {
      const v = num(form[k])
      if (v !== undefined) entry[k] = k === 'bodyFat' ? v : fromDisplayLength(v, unit)
    })
    saveBody.mutate({ id: existing?.id, entry }, { onSuccess: () => setForm(emptyForm()) })
  }

  const delta = (a?: number, b?: number) => {
    if (a === undefined || b === undefined) return '—'
    const d = weight(a - b)
    return `${d > 0 ? '+' : ''}${d} ${unit}`
  }

  return (
    <>
      <PageHead title="Progress" sub="Bodyweight, body fat and measurements over time." />
      <MutationFeedback
        mutations={[
          [saveBody, 'Check-in saved.'],
          [deleteBody, 'Check-in deleted.'],
        ]}
      />
      <QueryState queries={[bodyQuery, goalsQuery]}>
        <div className="stats">
          <Stat
            label="Current weight"
            value={latest ? `${weight(latest.weight)} ${unit}` : '—'}
            sub={latest && fmtDate(latest.date)}
          />
          <Stat
            label="7-day average"
            value={thisWeek ? `${weight(thisWeek)} ${unit}` : '—'}
            sub={`vs last week: ${delta(thisWeek, lastWeek)}`}
          />
          <Stat label="30-day change" value={delta(latest?.weight, monthAgo?.weight)} />
          <Stat
            label="To target"
            value={latest ? delta(targetWeight, latest.weight) : '—'}
            sub={`Target ${weight(targetWeight)} ${unit}`}
          />
        </div>

        <div className="grid-2">
          <Card
            title="Trend"
            action={
              <select
                aria-label="Trend metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value as Metric)}
              >
                <option value="weight">Weight</option>
                {FIELDS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            }
          >
            {series.length < 2 ? (
              <Empty>Add at least two entries to see a trend.</Empty>
            ) : (
              <div className="chart">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={series}>
                    <CartesianGrid stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="label" tick={chart.axis} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={chart.axis}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip {...chart.tooltip} />
                    {metric === 'weight' && (
                      <ReferenceLine
                        y={weight(targetWeight)}
                        stroke={chart.tertiary}
                        strokeDasharray="4 4"
                        label={{
                          value: 'target',
                          fill: 'var(--muted)',
                          fontSize: 11,
                          position: 'insideTopRight',
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={chart.primary}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Log check-in">
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>
                  Date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </label>
                <label>
                  Weight ({unit}) *
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    required
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  />
                </label>
                {FIELDS.map(([k, l]) => (
                  <label key={k}>
                    {l}
                    {k === 'bodyFat' ? '' : ` (${lenUnit})`}
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <p className="muted small">
                Weigh in every morning, same conditions. Only weight is required.
              </p>
              <button type="submit">Save check-in</button>
            </form>
          </Card>
        </div>

        <Card title="Check-ins">
          {asc.length === 0 ? (
            <Empty>No check-ins yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Weight</th>
                    {FIELDS.map(([k, l]) => (
                      <th key={k}>{l}</th>
                    ))}
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].sort(byDateDesc).map((b) => (
                    <tr key={b.id}>
                      <td>{fmtDate(b.date)}</td>
                      <td>
                        <strong>{weight(b.weight)}</strong>
                      </td>
                      {FIELDS.map(([k]) => (
                        <td key={k} className="muted">
                          {b[k] === undefined ? '—' : show(k, b[k])}
                        </td>
                      ))}
                      <td>
                        <button
                          className="ghost danger small"
                          aria-label={`Delete ${fmtDate(b.date)}`}
                          onClick={() => deleteBody.mutate(b.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </QueryState>
    </>
  )
}
