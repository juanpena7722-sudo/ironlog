import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { DEFAULT_GOALS, useDeleteHealth, useGoals, useHealth, useSaveHealth } from '../store'
import type { HealthEntry } from '../types'
import { Card, Empty, MutationFeedback, PageHead, QueryState, Stat, chart } from '../components/ui'
import { byDateDesc, fmtDate, lastNDays, num, round, today, uid } from '../utils'

type Form = {
  date: string
  sleepHours: string
  waterL: string
  restingHR: string
  steps: string
  energy: string
  notes: string
}

const toForm = (date: string, h?: HealthEntry): Form => ({
  date,
  sleepHours: h?.sleepHours?.toString() ?? '',
  waterL: h?.waterL?.toString() ?? '',
  restingHR: h?.restingHR?.toString() ?? '',
  steps: h?.steps?.toString() ?? '',
  energy: h?.energy?.toString() ?? '',
  notes: h?.notes ?? '',
})

const ENERGY = ['', '😫 Drained', '😕 Low', '😐 OK', '🙂 Good', '🔥 Great']

const NO_ENTRIES: HealthEntry[] = []

const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}

export default function Health() {
  const healthQuery = useHealth()
  const goalsQuery = useGoals()
  const entries = healthQuery.data ?? NO_ENTRIES
  const g = goalsQuery.data ?? DEFAULT_GOALS
  const saveHealth = useSaveHealth()
  const deleteHealth = useDeleteHealth()
  const [date, setDate] = useState(today())
  const existing = entries.find((h) => h.date === date)
  // Unedited, the form shows the stored entry for the date, including once it has loaded.
  const [edited, setForm] = useState<Form | null>(null)
  const form = edited ?? toForm(date, existing)

  const selectDate = (d: string) => {
    setDate(d)
    setForm(null)
  }

  const week = lastNDays(7).map((d) => entries.find((h) => h.date === d))

  const series = useMemo(
    () =>
      lastNDays(14).map((d) => {
        const h = entries.find((x) => x.date === d)
        return { label: fmtDate(d), sleep: h?.sleepHours, water: h?.waterL, hr: h?.restingHR }
      }),
    [entries],
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const entry: HealthEntry = {
      id: existing?.id ?? uid(),
      date,
      sleepHours: num(form.sleepHours),
      waterL: num(form.waterL),
      restingHR: num(form.restingHR),
      steps: num(form.steps),
      energy: num(form.energy),
      notes: form.notes.trim() || undefined,
    }
    saveHealth.mutate(entry)
  }

  const fmt = (v: number | undefined, u: string, dp = 1) =>
    v === undefined ? '—' : `${round(v, dp)}${u}`

  return (
    <>
      <PageHead
        title="Health"
        sub="Recovery drives growth: sleep, hydration, heart rate and energy."
      />
      <MutationFeedback
        mutations={[
          [saveHealth, 'Day saved.'],
          [deleteHealth, 'Day deleted.'],
        ]}
      />
      <QueryState queries={[healthQuery, goalsQuery]}>
        <div className="stats">
          <Stat
            label="Avg sleep (7d)"
            value={fmt(avg(week.map((h) => h?.sleepHours)), ' h')}
            sub={`Goal ${g.sleepHours} h`}
          />
          <Stat
            label="Avg water (7d)"
            value={fmt(avg(week.map((h) => h?.waterL)), ' L')}
            sub={`Goal ${g.waterL} L`}
          />
          <Stat
            label="Resting HR (7d)"
            value={fmt(avg(week.map((h) => h?.restingHR)), ' bpm', 0)}
          />
          <Stat label="Avg steps (7d)" value={fmt(avg(week.map((h) => h?.steps)), '', 0)} />
        </div>

        <div className="grid-2">
          <Card title="Daily log">
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>
                  Date
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => selectDate(e.target.value || today())}
                  />
                </label>
                <label>
                  Sleep (h)
                  <input
                    type="number"
                    step={0.25}
                    min={0}
                    max={24}
                    value={form.sleepHours}
                    onChange={(e) => setForm({ ...form, sleepHours: e.target.value })}
                  />
                </label>
                <label>
                  Water (L)
                  <input
                    type="number"
                    step={0.25}
                    min={0}
                    value={form.waterL}
                    onChange={(e) => setForm({ ...form, waterL: e.target.value })}
                  />
                </label>
                <label>
                  Resting HR (bpm)
                  <input
                    type="number"
                    min={0}
                    value={form.restingHR}
                    onChange={(e) => setForm({ ...form, restingHR: e.target.value })}
                  />
                </label>
                <label>
                  Steps
                  <input
                    type="number"
                    min={0}
                    value={form.steps}
                    onChange={(e) => setForm({ ...form, steps: e.target.value })}
                  />
                </label>
                <label>
                  Energy
                  <select
                    value={form.energy}
                    onChange={(e) => setForm({ ...form, energy: e.target.value })}
                  >
                    {ENERGY.map((l, i) => (
                      <option key={i} value={i === 0 ? '' : i}>
                        {l || '—'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                Notes
                <textarea
                  rows={2}
                  value={form.notes}
                  placeholder="Soreness, stress, supplements, bloodwork…"
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <button type="submit">{existing ? 'Update day' : 'Save day'}</button>
            </form>
          </Card>

          <Card title="Last 14 days">
            <div className="chart">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={series}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="label" tick={chart.axis} tickLine={false} axisLine={false} />
                  <YAxis tick={chart.axis} tickLine={false} axisLine={false} width={32} />
                  <Tooltip {...chart.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="sleep"
                    name="Sleep (h)"
                    fill={chart.secondary}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    dataKey="water"
                    name="Water (L)"
                    stroke={chart.tertiary}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card title="History">
          {entries.length === 0 ? (
            <Empty>No health logs yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sleep</th>
                    <th>Water</th>
                    <th>RHR</th>
                    <th>Steps</th>
                    <th>Energy</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...entries].sort(byDateDesc).map((h) => (
                    <tr key={h.id}>
                      <td>
                        <button className="link" onClick={() => selectDate(h.date)}>
                          {fmtDate(h.date)}
                        </button>
                      </td>
                      <td>{fmt(h.sleepHours, ' h')}</td>
                      <td>{fmt(h.waterL, ' L')}</td>
                      <td>{fmt(h.restingHR, '', 0)}</td>
                      <td>{h.steps?.toLocaleString() ?? '—'}</td>
                      <td>{h.energy ? ENERGY[h.energy] : '—'}</td>
                      <td className="muted notes">{h.notes ?? ''}</td>
                      <td>
                        <button
                          className="ghost danger small"
                          aria-label={`Delete ${fmtDate(h.date)}`}
                          onClick={() => deleteHealth.mutate(h.date)}
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
