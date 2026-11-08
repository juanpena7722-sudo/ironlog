import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useStore } from '../store'
import type { AppData, Goals } from '../types'
import { Card, PageHead } from '../components/ui'
import { makeDemoData } from '../demo'
import { byDateAsc, round } from '../utils'

type Pending = 'reset' | 'demo' | null

export default function Settings() {
  const { data, setGoals, replaceAll } = useStore()
  const [goals, setLocal] = useState<Goals>(data.goals)
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  const [exportText, setExportText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const latestWeight = [...data.body].sort(byDateAsc).at(-1)?.weight
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const field = (k: keyof Goals) => ({
    value: goals[k] as number,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setLocal({ ...goals, [k]: Number(e.target.value) || 0 }),
  })

  const save = (e: FormEvent) => {
    e.preventDefault()
    setGoals(goals)
    flash('Targets saved.')
  }

  // Common bodybuilding starting point: ~2.2 g/kg protein, ~0.9 g/kg fat, rest carbs.
  const suggest = () => {
    if (!latestWeight) return
    const kg = goals.unit === 'kg' ? latestWeight : latestWeight / 2.2046
    const protein = Math.round(kg * 2.2)
    const fat = Math.round(kg * 0.9)
    const carbs = Math.max(0, Math.round((goals.calories - protein * 4 - fat * 9) / 4))
    setLocal({ ...goals, protein, fat, carbs })
  }

  const macroKcal = goals.protein * 4 + goals.carbs * 4 + goals.fat * 9

  const doExport = () => {
    const json = JSON.stringify(data, null, 2)
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `ironlog-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      flash('Backup downloaded.')
    } catch {
      // Fall back to showing the JSON so it can be copied manually.
      setExportText(json)
      flash('Copy the backup text below.')
    }
  }

  const doImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as AppData
      replaceAll(parsed)
      setLocal({ ...data.goals, ...parsed.goals })
      flash('Data imported.')
    } catch {
      flash('That file is not a valid IronLog backup.')
    }
    e.target.value = ''
  }

  const confirm = () => {
    if (pending === 'reset') {
      replaceAll({ version: 1, workouts: [], foods: [], body: [], health: [], goals: data.goals })
      flash('All logs cleared.')
    } else if (pending === 'demo') {
      const demo = makeDemoData()
      replaceAll(demo)
      setLocal(demo.goals)
      flash('Demo data loaded.')
    }
    setPending(null)
  }

  return (
    <>
      <PageHead title="Settings" sub="Targets, units and your data." />
      {msg && <div className="toast">{msg}</div>}

      <div className="grid-2">
        <Card title="Targets">
          <form onSubmit={save}>
            <div className="form-grid">
              <label>
                Units
                <select value={goals.unit} onChange={(e) => setLocal({ ...goals, unit: e.target.value as Goals['unit'] })}>
                  <option value="kg">kg / cm</option>
                  <option value="lb">lb / in</option>
                </select>
              </label>
              <label>Target weight ({goals.unit}) <input type="number" step={0.1} {...field('targetWeight')} /></label>
              <label>Calories (kcal) <input type="number" {...field('calories')} /></label>
              <label>Protein (g) <input type="number" {...field('protein')} /></label>
              <label>Carbs (g) <input type="number" {...field('carbs')} /></label>
              <label>Fat (g) <input type="number" {...field('fat')} /></label>
              <label>Water (L) <input type="number" step={0.25} {...field('waterL')} /></label>
              <label>Sleep (h) <input type="number" step={0.25} {...field('sleepHours')} /></label>
            </div>
            <p className={`small ${Math.abs(macroKcal - goals.calories) > 100 ? 'warn' : 'muted'}`}>
              Macros add up to {round(macroKcal, 0)} kcal ({macroKcal >= goals.calories ? '+' : ''}{round(macroKcal - goals.calories, 0)} vs calorie target).
            </p>
            <div className="actions">
              <button type="submit">Save targets</button>
              <button type="button" className="ghost" disabled={!latestWeight} onClick={suggest}
                title={latestWeight ? '' : 'Log a weigh-in first'}>
                Suggest macros from bodyweight
              </button>
            </div>
          </form>
        </Card>

        <Card title="Your data">
          <p className="muted small">
            Everything is stored in this browser only. Export a backup regularly, especially before clearing site data.
          </p>
          <p className="small">
            {data.workouts.length} workouts · {data.foods.length} food entries · {data.body.length} check-ins · {data.health.length} health logs
          </p>
          <div className="actions">
            <button className="ghost" onClick={doExport}>Export backup</button>
            <button className="ghost" onClick={() => fileRef.current?.click()}>Import backup</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
          </div>
          <div className="actions">
            <button className="ghost" onClick={() => setPending('demo')}>Load demo data</button>
            <button className="ghost danger" onClick={() => setPending('reset')}>Clear all logs</button>
          </div>
          {pending && (
            <div className="confirm">
              <p>
                {pending === 'reset'
                  ? 'Delete every workout, food, check-in and health log? Targets are kept.'
                  : 'Replace all your current data with 60 days of sample data?'}{' '}
                This can’t be undone.
              </p>
              <div className="actions">
                <button className="danger-solid" onClick={confirm}>Yes, continue</button>
                <button className="ghost" onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          )}
          {exportText && (
            <textarea className="export" rows={6} readOnly value={exportText} onFocus={(e) => e.target.select()} />
          )}
        </Card>
      </div>
    </>
  )
}
