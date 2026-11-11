import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DEFAULT_GOALS,
  useAddFood,
  useDeleteFood,
  useFoods,
  useGoals,
  useRecentFoods,
} from '../store'
import { MEALS } from '../types'
import type { FoodEntry, Meal } from '../types'
import { Card, Empty, Meter, PageHead, chart } from '../components/ui'
import { daysAgo, fmtDate, fmtLongDate, lastNDays, num, today, totals, uid } from '../utils'

type FoodForm = {
  name: string
  meal: Meal
  calories: string
  protein: string
  carbs: string
  fat: string
}

const HISTORY_DAYS = 14
const NO_FOODS: FoodEntry[] = []

const emptyForm: FoodForm = {
  name: '',
  meal: 'Breakfast',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
}

export default function Diet() {
  const g = useGoals().data ?? DEFAULT_GOALS
  const [date, setDate] = useState(today())
  const [form, setForm] = useState<FoodForm>(emptyForm)
  const dayEntries = useFoods({ from: date, to: date }).data ?? NO_FOODS
  const historyFoods = useFoods({ from: daysAgo(HISTORY_DAYS - 1) }).data ?? NO_FOODS
  const recent = useRecentFoods().data ?? NO_FOODS
  const addFood = useAddFood()
  const deleteFood = useDeleteFood()

  const t = totals(dayEntries)

  const history = useMemo(
    () =>
      lastNDays(HISTORY_DAYS).map((d) => {
        const tt = totals(historyFoods.filter((f) => f.date === d))
        return { label: fmtDate(d), ...tt }
      }),
    [historyFoods],
  )

  const macroKcal =
    (num(form.protein) ?? 0) * 4 + (num(form.carbs) ?? 0) * 4 + (num(form.fat) ?? 0) * 9

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    addFood.mutate(
      {
        id: uid(),
        date,
        meal: form.meal,
        name: form.name.trim(),
        calories: num(form.calories) ?? Math.round(macroKcal),
        protein: num(form.protein) ?? 0,
        carbs: num(form.carbs) ?? 0,
        fat: num(form.fat) ?? 0,
      },
      { onSuccess: () => setForm({ ...emptyForm, meal: form.meal }) },
    )
  }

  const quickAdd = (f: FoodEntry) => addFood.mutate({ ...f, date, meal: form.meal })

  return (
    <>
      <PageHead title="Diet" sub="Track calories and macros against your targets." />

      <div className="actions">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
        {date !== today() && (
          <button className="ghost small" onClick={() => setDate(today())}>
            Today
          </button>
        )}
        <span className="muted">{fmtLongDate(date)}</span>
      </div>

      <div className="grid-2">
        <Card title="Daily targets">
          <Meter label="Calories" value={t.calories} goal={g.calories} unit=" kcal" />
          <Meter label="Protein" value={t.protein} goal={g.protein} unit=" g" />
          <Meter label="Carbs" value={t.carbs} goal={g.carbs} unit=" g" />
          <Meter label="Fat" value={t.fat} goal={g.fat} unit=" g" />
          <p className="muted small">
            {t.calories < g.calories
              ? `${Math.round(g.calories - t.calories)} kcal left`
              : `${Math.round(t.calories - g.calories)} kcal over target`}
            {' · '}
            {t.protein < g.protein
              ? `${Math.round(g.protein - t.protein)} g protein to go`
              : 'protein target hit 💪'}
          </p>
        </Card>

        <Card title="Add food">
          <form onSubmit={submit}>
            <div className="form-grid">
              <label className="span-2">
                Food
                <input
                  value={form.name}
                  placeholder="Chicken breast 200g"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Meal
                <select
                  value={form.meal}
                  onChange={(e) => setForm({ ...form, meal: e.target.value as Meal })}
                >
                  {MEALS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Calories
                <input
                  type="number"
                  min={0}
                  value={form.calories}
                  placeholder={macroKcal ? String(Math.round(macroKcal)) : 'kcal'}
                  onChange={(e) => setForm({ ...form, calories: e.target.value })}
                />
              </label>
              <label>
                Protein (g)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.protein}
                  onChange={(e) => setForm({ ...form, protein: e.target.value })}
                />
              </label>
              <label>
                Carbs (g)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.carbs}
                  onChange={(e) => setForm({ ...form, carbs: e.target.value })}
                />
              </label>
              <label>
                Fat (g)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.fat}
                  onChange={(e) => setForm({ ...form, fat: e.target.value })}
                />
              </label>
            </div>
            <p className="muted small">Leave calories empty to calculate from macros (4/4/9).</p>
            <button type="submit">Add</button>
          </form>
          {recent.length > 0 && (
            <>
              <h3 className="sub-head">Quick add to {form.meal}</h3>
              <div className="chips">
                {recent.map((f) => (
                  <button
                    key={f.id}
                    className="chip"
                    onClick={() => quickAdd(f)}
                    title={`${f.calories} kcal · ${f.protein}P / ${f.carbs}C / ${f.fat}F`}
                  >
                    + {f.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card title="Food log">
        {dayEntries.length === 0 ? (
          <Empty>Nothing logged for this day.</Empty>
        ) : (
          MEALS.map((meal) => {
            const items = dayEntries.filter((f) => f.meal === meal)
            if (items.length === 0) return null
            const mt = totals(items)
            return (
              <div key={meal} className="meal">
                <div className="meal-head">
                  <strong>{meal}</strong>
                  <span className="muted small">
                    {Math.round(mt.calories)} kcal · {Math.round(mt.protein)}P /{' '}
                    {Math.round(mt.carbs)}C / {Math.round(mt.fat)}F
                  </span>
                </div>
                {items.map((f) => (
                  <div key={f.id} className="detail-line">
                    <span>{f.name}</span>
                    <span className="muted">
                      {f.calories} kcal · {f.protein}P / {f.carbs}C / {f.fat}F
                      <button
                        className="ghost danger small"
                        onClick={() => deleteFood.mutate(f.id)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </Card>

      <Card title="Last 14 days">
        <div className="chart">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={history}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="label" tick={chart.axis} tickLine={false} axisLine={false} />
              <YAxis tick={chart.axis} tickLine={false} axisLine={false} width={50} />
              <Tooltip
                {...chart.tooltip}
                formatter={(v: number, n: string) => [
                  Math.round(v),
                  n === 'calories' ? 'kcal' : `${n} (g)`,
                ]}
              />
              <ReferenceLine
                y={g.calories}
                stroke={chart.secondary}
                strokeDasharray="4 4"
                label={{
                  value: 'target',
                  fill: 'var(--muted)',
                  fontSize: 11,
                  position: 'insideTopRight',
                }}
              />
              <Bar dataKey="calories" fill={chart.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  )
}
