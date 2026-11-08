import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { MUSCLES } from '../types'
import type { ExerciseEntry, Workout } from '../types'
import { Card, Empty, PageHead, chart } from '../components/ui'
import {
  byDateDesc,
  e1rm,
  exerciseVolume,
  fmtDate,
  fmtLongDate,
  num,
  round,
  today,
  uid,
  weekStart,
  workoutVolume,
  daysAgo,
} from '../utils'

const newExercise = (): ExerciseEntry => ({
  id: uid(),
  name: '',
  muscle: 'Chest',
  sets: [{ reps: 8, weight: 0 }],
})

const blankWorkout = (): Workout => ({
  id: uid(),
  date: today(),
  name: '',
  exercises: [newExercise()],
})

export default function Workouts() {
  const { data, upsert, remove } = useStore()
  const unit = data.goals.unit
  const [draft, setDraft] = useState<Workout | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const workouts = useMemo(() => [...data.workouts].sort(byDateDesc), [data.workouts])

  const exerciseNames = useMemo(() => {
    const s = new Set<string>()
    data.workouts.forEach((w) => w.exercises.forEach((e) => e.name && s.add(e.name)))
    return [...s].sort()
  }, [data.workouts])

  const lastMuscleFor = useMemo(() => {
    const m = new Map<string, string>()
    ;[...data.workouts]
      .sort(byDateDesc)
      .reverse()
      .forEach((w) => w.exercises.forEach((e) => m.set(e.name.toLowerCase(), e.muscle)))
    return m
  }, [data.workouts])

  const prs = useMemo(() => {
    const best = new Map<
      string,
      { name: string; weight: number; reps: number; e1rm: number; date: string }
    >()
    data.workouts.forEach((w) =>
      w.exercises.forEach((ex) =>
        ex.sets.forEach((s) => {
          const est = e1rm(s.weight, s.reps)
          const key = ex.name.trim().toLowerCase()
          if (!key || est <= 0) return
          const cur = best.get(key)
          if (!cur || est > cur.e1rm)
            best.set(key, {
              name: ex.name.trim(),
              weight: s.weight,
              reps: s.reps,
              e1rm: est,
              date: w.date,
            })
        }),
      ),
    )
    return [...best.values()].sort((a, b) => b.e1rm - a.e1rm)
  }, [data.workouts])

  const weekly = useMemo(() => {
    const weeks: { week: string; volume: number; sessions: number }[] = []
    for (let i = 7; i >= 0; i--) {
      weeks.push({ week: weekStart(daysAgo(i * 7)), volume: 0, sessions: 0 })
    }
    data.workouts.forEach((w) => {
      const wk = weeks.find((x) => x.week === weekStart(w.date))
      if (wk) {
        wk.volume += workoutVolume(w)
        wk.sessions += 1
      }
    })
    return weeks.map((w) => ({ ...w, label: fmtDate(w.week) }))
  }, [data.workouts])

  const patch = (fn: (w: Workout) => Workout) => setDraft((d) => (d ? fn(d) : d))
  const patchEx = (id: string, fn: (e: ExerciseEntry) => ExerciseEntry) =>
    patch((w) => ({ ...w, exercises: w.exercises.map((e) => (e.id === id ? fn(e) : e)) }))

  const startFrom = (w: Workout) =>
    setDraft({
      ...structuredClone(w),
      id: uid(),
      date: today(),
      exercises: w.exercises.map((e) => ({ ...structuredClone(e), id: uid() })),
    })

  const save = () => {
    if (!draft) return
    const cleaned: Workout = {
      ...draft,
      name: draft.name.trim() || 'Workout',
      exercises: draft.exercises
        .filter((e) => e.name.trim())
        .map((e) => ({ ...e, name: e.name.trim(), sets: e.sets.filter((s) => s.reps > 0) })),
    }
    if (cleaned.exercises.length === 0) return
    upsert('workouts', cleaned)
    setDraft(null)
  }

  return (
    <>
      <PageHead title="Workouts" sub="Log sessions, track your lifts and personal records." />

      {draft ? (
        <Card title={data.workouts.some((w) => w.id === draft.id) ? 'Edit workout' : 'New workout'}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={draft.name}
                placeholder="Push day, Legs…"
                onChange={(e) => patch((w) => ({ ...w, name: e.target.value }))}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={draft.date}
                onChange={(e) => patch((w) => ({ ...w, date: e.target.value }))}
              />
            </label>
            <label>
              Duration (min)
              <input
                type="number"
                min={0}
                value={draft.durationMin ?? ''}
                onChange={(e) => patch((w) => ({ ...w, durationMin: num(e.target.value) }))}
              />
            </label>
          </div>

          <datalist id="exercise-names">
            {exerciseNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          {draft.exercises.map((ex, i) => (
            <div key={ex.id} className="exercise">
              <div className="exercise-head">
                <span className="badge">{i + 1}</span>
                <input
                  list="exercise-names"
                  placeholder="Exercise (e.g. Bench Press)"
                  value={ex.name}
                  onChange={(e) => {
                    const name = e.target.value
                    const known = lastMuscleFor.get(name.toLowerCase())
                    patchEx(ex.id, (x) => ({ ...x, name, muscle: known ?? x.muscle }))
                  }}
                />
                <select
                  value={ex.muscle}
                  onChange={(e) => patchEx(ex.id, (x) => ({ ...x, muscle: e.target.value }))}
                >
                  {MUSCLES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <button
                  className="ghost danger"
                  title="Remove exercise"
                  onClick={() =>
                    patch((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== ex.id) }))
                  }
                >
                  ✕
                </button>
              </div>
              <table className="sets">
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>Weight ({unit})</th>
                    <th>Reps</th>
                    <th>e1RM</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((s, si) => (
                    <tr key={si}>
                      <td>{si + 1}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={s.weight}
                          onChange={(e) =>
                            patchEx(ex.id, (x) => ({
                              ...x,
                              sets: x.sets.map((y, yi) =>
                                yi === si ? { ...y, weight: num(e.target.value) ?? 0 } : y,
                              ),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={s.reps}
                          onChange={(e) =>
                            patchEx(ex.id, (x) => ({
                              ...x,
                              sets: x.sets.map((y, yi) =>
                                yi === si ? { ...y, reps: num(e.target.value) ?? 0 } : y,
                              ),
                            }))
                          }
                        />
                      </td>
                      <td className="muted">{round(e1rm(s.weight, s.reps))}</td>
                      <td>
                        <button
                          className="ghost danger"
                          title="Remove set"
                          onClick={() =>
                            patchEx(ex.id, (x) => ({
                              ...x,
                              sets: x.sets.filter((_, yi) => yi !== si),
                            }))
                          }
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                className="ghost small"
                onClick={() =>
                  patchEx(ex.id, (x) => ({
                    ...x,
                    sets: [...x.sets, { ...(x.sets.at(-1) ?? { reps: 8, weight: 0 }) }],
                  }))
                }
              >
                + Add set
              </button>
            </div>
          ))}

          <button
            className="ghost"
            onClick={() => patch((w) => ({ ...w, exercises: [...w.exercises, newExercise()] }))}
          >
            + Add exercise
          </button>

          <label className="block">
            Notes
            <textarea
              rows={2}
              value={draft.notes ?? ''}
              placeholder="How did it feel? Pump, fatigue, form cues…"
              onChange={(e) => patch((w) => ({ ...w, notes: e.target.value }))}
            />
          </label>

          <div className="actions">
            <button onClick={save}>Save workout</button>
            <button className="ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </Card>
      ) : (
        <div className="actions">
          <button onClick={() => setDraft(blankWorkout())}>+ Log workout</button>
          {workouts[0] && (
            <button className="ghost" onClick={() => startFrom(workouts[0])}>
              Repeat “{workouts[0].name}”
            </button>
          )}
        </div>
      )}

      <div className="grid-2">
        <Card title="Weekly volume">
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekly}>
                <CartesianGrid stroke={chart.grid} vertical={false} />
                <XAxis dataKey="label" tick={chart.axis} tickLine={false} axisLine={false} />
                <YAxis tick={chart.axis} tickLine={false} axisLine={false} width={50} />
                <Tooltip
                  {...chart.tooltip}
                  formatter={(v: number) => [`${Math.round(v).toLocaleString()} ${unit}`, 'Volume']}
                />
                <Bar dataKey="volume" fill={chart.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Personal records (est. 1RM)">
          {prs.length === 0 ? (
            <Empty>Log a workout to see your PRs.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Best set</th>
                    <th>e1RM</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.slice(0, 10).map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>
                        {p.weight} × {p.reps}
                      </td>
                      <td>
                        <strong>{round(p.e1rm)}</strong> {unit}
                      </td>
                      <td className="muted">{fmtDate(p.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="History">
        {workouts.length === 0 ? (
          <Empty>No workouts yet. Hit “Log workout” to start.</Empty>
        ) : (
          <ul className="list">
            {workouts.map((w) => (
              <li key={w.id} className="list-item">
                <button
                  className="list-row"
                  onClick={() => setOpenId(openId === w.id ? null : w.id)}
                >
                  <div>
                    <strong>{w.name}</strong>
                    <div className="muted small">
                      {fmtLongDate(w.date)}
                      {w.durationMin ? ` · ${w.durationMin} min` : ''}
                    </div>
                  </div>
                  <div className="muted small right">
                    {w.exercises.length} exercises · {Math.round(workoutVolume(w)).toLocaleString()}{' '}
                    {unit}
                  </div>
                </button>
                {openId === w.id && (
                  <div className="list-detail">
                    {w.exercises.map((e) => (
                      <div key={e.id} className="detail-line">
                        <span>
                          {e.name} <span className="tag">{e.muscle}</span>
                        </span>
                        <span className="muted">
                          {e.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')} ·{' '}
                          {Math.round(exerciseVolume(e))} {unit}
                        </span>
                      </div>
                    ))}
                    {w.notes && <p className="muted">{w.notes}</p>}
                    <div className="actions">
                      <button
                        className="ghost small"
                        onClick={() => {
                          setDraft(structuredClone(w))
                          window.scrollTo({ top: 0 })
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost small"
                        onClick={() => {
                          startFrom(w)
                          window.scrollTo({ top: 0 })
                        }}
                      >
                        Use as template
                      </button>
                      <button
                        className="ghost small danger"
                        onClick={() => remove('workouts', w.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
