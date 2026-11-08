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
import { useStore } from '../store'
import type { BodyEntry } from '../types'
import { Card, Empty, PageHead, Stat, chart } from '../components/ui'
import { byDateAsc, byDateDesc, daysAgo, fmtDate, num, round, today, uid } from '../utils'

const FIELDS = [
  ['bodyFat', 'Body fat %'],
  ['chest', 'Chest'],
  ['waist', 'Waist'],
  ['arms', 'Arms'],
  ['thighs', 'Thighs'],
] as const

type Form = Record<'date' | 'weight' | (typeof FIELDS)[number][0], string>
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
  const { data, upsert, remove } = useStore()
  const { unit, targetWeight } = data.goals
  const lenUnit = unit === 'kg' ? 'cm' : 'in'
  const [form, setForm] = useState<Form>(emptyForm)
  const [metric, setMetric] = useState<'weight' | (typeof FIELDS)[number][0]>('weight')

  const asc = useMemo(() => [...data.body].sort(byDateAsc), [data.body])
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
    .map((b) => ({ label: fmtDate(b.date), value: b[metric] as number }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const weight = num(form.weight)
    if (weight === undefined) return
    // One entry per day: replace any existing entry with the same date.
    const existing = data.body.find((b) => b.date === form.date)
    const entry: BodyEntry = { id: existing?.id ?? uid(), date: form.date, weight }
    FIELDS.forEach(([k]) => {
      const v = num(form[k])
      if (v !== undefined) entry[k] = v
    })
    upsert('body', entry)
    setForm(emptyForm())
  }

  const delta = (a?: number, b?: number) => {
    if (a === undefined || b === undefined) return '—'
    const d = round(a - b)
    return `${d > 0 ? '+' : ''}${d} ${unit}`
  }

  return (
    <>
      <PageHead title="Progress" sub="Bodyweight, body fat and measurements over time." />

      <div className="stats">
        <Stat
          label="Current weight"
          value={latest ? `${latest.weight} ${unit}` : '—'}
          sub={latest && fmtDate(latest.date)}
        />
        <Stat
          label="7-day average"
          value={thisWeek ? `${round(thisWeek)} ${unit}` : '—'}
          sub={`vs last week: ${delta(thisWeek, lastWeek)}`}
        />
        <Stat label="30-day change" value={delta(latest?.weight, monthAgo?.weight)} />
        <Stat
          label="To target"
          value={latest ? delta(targetWeight, latest.weight) : '—'}
          sub={`Target ${targetWeight} ${unit}`}
        />
      </div>

      <div className="grid-2">
        <Card
          title="Trend"
          action={
            <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
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
                      y={targetWeight}
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...data.body].sort(byDateDesc).map((b) => (
                  <tr key={b.id}>
                    <td>{fmtDate(b.date)}</td>
                    <td>
                      <strong>{b.weight}</strong>
                    </td>
                    {FIELDS.map(([k]) => (
                      <td key={k} className="muted">
                        {b[k] ?? '—'}
                      </td>
                    ))}
                    <td>
                      <button className="ghost danger small" onClick={() => remove('body', b.id)}>
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
    </>
  )
}
