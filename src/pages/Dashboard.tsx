import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  DEFAULT_GOALS,
  useBody,
  useFoods,
  useGoals,
  useHealth,
  useRecentFoods,
  useWorkouts,
} from '../store'
import type { BodyEntry, FoodEntry, HealthEntry, Workout } from '../types'
import { Card, Empty, Meter, PageHead, Stat, chart } from '../components/ui'
import {
  byDateAsc,
  byDateDesc,
  daysAgo,
  fmtDate,
  fmtLongDate,
  today,
  totals,
  weekStart,
  workoutVolume,
} from '../utils'
import { toDisplayWeight } from '../units'

const NO_WORKOUTS: Workout[] = []
const NO_FOODS: FoodEntry[] = []
const NO_BODY: BodyEntry[] = []
const NO_HEALTH: HealthEntry[] = []

export default function Dashboard() {
  const t = today()
  const g = useGoals().data ?? DEFAULT_GOALS
  const workouts = useWorkouts().data ?? NO_WORKOUTS
  const foods = useFoods({ from: t, to: t }).data ?? NO_FOODS
  const hasFoods = Boolean(useRecentFoods().data?.length)
  const bodyEntries = useBody().data ?? NO_BODY
  const healthEntries = useHealth().data ?? NO_HEALTH
  const weight = (kg: number) => toDisplayWeight(kg, g.unit)

  const food = totals(foods)
  const health = healthEntries.find((h) => h.date === t)
  const body = useMemo(() => [...bodyEntries].sort(byDateAsc), [bodyEntries])
  const latest = body.at(-1)
  const weekAgo = [...body].reverse().find((b) => b.date <= daysAgo(7))

  const thisWeek = workouts.filter((w) => weekStart(w.date) === weekStart(t))
  const weekVolume = thisWeek.reduce((s, w) => s + workoutVolume(w), 0)
  const recentWorkouts = [...workouts].sort(byDateDesc).slice(0, 4)

  const muscleSets = useMemo(() => {
    const m = new Map<string, number>()
    thisWeek.forEach((w) =>
      w.exercises.forEach((e) => m.set(e.muscle, (m.get(e.muscle) ?? 0) + e.sets.length)),
    )
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [thisWeek])
  const maxSets = Math.max(1, ...muscleSets.map(([, n]) => n))

  const weightSeries = body
    .filter((b) => b.date > daysAgo(60))
    .map((b) => ({ label: fmtDate(b.date), weight: weight(b.weight) }))
  const weightDelta = latest && weekAgo ? weight(latest.weight - weekAgo.weight) : undefined

  const isEmpty = !workouts.length && !hasFoods && !bodyEntries.length && !healthEntries.length

  return (
    <>
      <PageHead title="Dashboard" sub={fmtLongDate(t)} />

      {isEmpty && (
        <Card className="welcome">
          <h2>Welcome to IronLog 🏋️</h2>
          <p className="muted">
            Start by setting your targets in <Link to="/settings">Settings</Link>, then log a{' '}
            <Link to="/workouts">workout</Link>, your <Link to="/diet">meals</Link>, a{' '}
            <Link to="/progress">weigh-in</Link> and your <Link to="/health">sleep</Link>. Want to
            look around first? Load demo data from Settings.
          </p>
        </Card>
      )}

      <div className="stats">
        <Stat
          label="Bodyweight"
          value={latest ? `${weight(latest.weight)} ${g.unit}` : '—'}
          sub={
            weightDelta !== undefined
              ? `${weightDelta > 0 ? '+' : ''}${weightDelta} ${g.unit} this week`
              : 'Log a weigh-in'
          }
        />
        <Stat
          label="Sessions this week"
          value={thisWeek.length}
          sub={`${Math.round(weight(weekVolume)).toLocaleString()} ${g.unit} volume`}
        />
        <Stat
          label="Calories today"
          value={Math.round(food.calories)}
          sub={`of ${g.calories} kcal`}
        />
        <Stat
          label="Sleep last night"
          value={health?.sleepHours !== undefined ? `${health.sleepHours} h` : '—'}
          sub={`Goal ${g.sleepHours} h`}
        />
      </div>

      <div className="grid-2">
        <Card
          title="Today's nutrition"
          action={
            <Link to="/diet" className="small">
              Log food →
            </Link>
          }
        >
          <Meter label="Calories" value={food.calories} goal={g.calories} unit=" kcal" />
          <Meter label="Protein" value={food.protein} goal={g.protein} unit=" g" />
          <Meter label="Carbs" value={food.carbs} goal={g.carbs} unit=" g" />
          <Meter label="Fat" value={food.fat} goal={g.fat} unit=" g" />
          <Meter label="Water" value={health?.waterL ?? 0} goal={g.waterL} unit=" L" />
        </Card>

        <Card
          title="Bodyweight (60 days)"
          action={
            <Link to="/progress" className="small">
              Check in →
            </Link>
          }
        >
          {weightSeries.length < 2 ? (
            <Empty>Log a few weigh-ins to see your trend.</Empty>
          ) : (
            <div className="chart">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weightSeries}>
                  <defs>
                    <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chart.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={chart.axis}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={chart.axis}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip {...chart.tooltip} />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke={chart.primary}
                    strokeWidth={2}
                    fill="url(#wg)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Muscles trained this week" action={<span className="muted small">sets</span>}>
          {muscleSets.length === 0 ? (
            <Empty>No training logged this week yet.</Empty>
          ) : (
            muscleSets.map(([m, n]) => (
              <div key={m} className="hbar">
                <span>{m}</span>
                <div className="meter-track">
                  <div className="meter-fill" style={{ width: `${(n / maxSets) * 100}%` }} />
                </div>
                <span className="muted">{n}</span>
              </div>
            ))
          )}
        </Card>

        <Card
          title="Recent workouts"
          action={
            <Link to="/workouts" className="small">
              All →
            </Link>
          }
        >
          {recentWorkouts.length === 0 ? (
            <Empty>No workouts logged yet.</Empty>
          ) : (
            <ul className="list">
              {recentWorkouts.map((w) => (
                <li key={w.id} className="detail-line">
                  <span>
                    <strong>{w.name}</strong> <span className="muted small">{fmtDate(w.date)}</span>
                  </span>
                  <span className="muted small">
                    {w.exercises.length} ex ·{' '}
                    {Math.round(weight(workoutVolume(w))).toLocaleString()} {g.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
