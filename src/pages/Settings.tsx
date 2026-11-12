import { useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AppDataSchema, DeleteAccountSchema } from '@shared/schemas'
import { errorMessage, useDeleteAccount } from '../api/auth'
import { apiRequest } from '../api/client'
import {
  DEFAULT_GOALS,
  normalize,
  useBody,
  useFoods,
  useGoals,
  useHealth,
  unitHintFor,
  useImportData,
  useSaveGoals,
  useWorkouts,
} from '../store'
import type { AppData, Goals } from '../types'
import { Card, Field, PageHead, QueryState } from '../components/ui'
import { makeDemoData } from '../demo'
import { byDateAsc, round } from '../utils'
import { fromDisplayWeight, toDisplayWeight } from '../units'

type Pending = 'reset' | 'demo' | 'import' | null
type ImportMode = 'merge' | 'replace'

const CONFIRM_TEXT = {
  reset: 'Delete every workout, food, check-in and health log? Targets are kept.',
  demo: 'Replace all your current data with 60 days of sample data?',
  import: 'Replace all your current data with this backup?',
}

export default function Settings() {
  const goalsQuery = useGoals()
  const workoutsQuery = useWorkouts()
  const foodsQuery = useFoods()
  const bodyQuery = useBody()
  const healthQuery = useHealth()
  const saved = goalsQuery.data
  const workouts = workoutsQuery.data ?? []
  const foods = foodsQuery.data ?? []
  const body = bodyQuery.data ?? []
  const health = healthQuery.data ?? []
  const saveGoals = useSaveGoals()
  const importData = useImportData()
  // targetWeight is in the display unit here. Until edited, the form shows the saved goals.
  const [edited, setLocal] = useState<Goals | null>(null)
  const current = saved ?? DEFAULT_GOALS
  const goals = edited ?? {
    ...current,
    targetWeight: toDisplayWeight(current.targetWeight, current.unit),
  }
  const [msg, setMsg] = useState({ text: '', isError: false })
  const [pending, setPending] = useState<Pending>(null)
  const [exportText, setExportText] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [replacement, setReplacement] = useState<{ data: AppData; unitHint: Goals['unit'] }>()
  const fileRef = useRef<HTMLInputElement>(null)
  const confirmId = useId()
  const deleteAccount = useDeleteAccount()
  const [isDeleting, setIsDeleting] = useState(false)
  const [passwordError, setPasswordError] = useState<string>()

  const latestWeight = [...body].sort(byDateAsc).at(-1)?.weight
  const flash = (text: string, isError = false) => {
    setMsg({ text, isError })
    setTimeout(() => setMsg({ text: '', isError: false }), 3000)
  }
  const flashError = (error: Error) => flash(errorMessage(error), true)

  const field = (k: keyof Goals) => ({
    value: goals[k] as number,
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setLocal({ ...goals, [k]: Number(e.target.value) || 0 }),
  })

  const save = (e: FormEvent) => {
    e.preventDefault()
    saveGoals.mutate(
      { ...goals, targetWeight: fromDisplayWeight(goals.targetWeight, goals.unit) },
      {
        onSuccess: () => {
          setLocal(null)
          flash('Targets saved.')
        },
        onError: flashError,
      },
    )
  }

  // Common bodybuilding starting point: ~2.2 g/kg protein, ~0.9 g/kg fat, rest carbs.
  const suggest = () => {
    if (!latestWeight) return
    const protein = Math.round(latestWeight * 2.2)
    const fat = Math.round(latestWeight * 0.9)
    const carbs = Math.max(0, Math.round((goals.calories - protein * 4 - fat * 9) / 4))
    setLocal({ ...goals, protein, fat, carbs })
  }

  const macroKcal = goals.protein * 4 + goals.carbs * 4 + goals.fat * 9

  const download = (data: AppData) => {
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

  const doExport = () => apiRequest('/backup', AppDataSchema).then(download, flashError)

  const sendImport = (data: AppData, mode: ImportMode, unitHint: Goals['unit']) =>
    importData.mutate(
      { data, mode, unitHint },
      {
        onSuccess: () => {
          setLocal(null)
          flash('Data imported.')
        },
        onError: flashError,
      },
    )

  const doImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    let data: AppData
    let unitHint: Goals['unit']
    try {
      const parsed = JSON.parse(await file.text()) as Partial<AppData>
      data = normalize(parsed)
      unitHint = unitHintFor(parsed)
    } catch {
      flash('That file is not a valid IronLog backup.', true)
      return
    }
    if (importMode === 'merge') {
      sendImport(data, 'merge', unitHint)
    } else {
      setReplacement({ data, unitHint })
      setPending('import')
    }
  }

  const cancel = () => {
    setPending(null)
    setReplacement(undefined)
  }

  const confirm = () => {
    // Clearing keeps the saved goals, so it waits until they have loaded.
    if (pending === 'reset' && saved) {
      importData.mutate(
        {
          data: { version: 1, workouts: [], foods: [], body: [], health: [], goals: saved },
          mode: 'replace',
        },
        { onSuccess: () => flash('All logs cleared.'), onError: flashError },
      )
    } else if (pending === 'demo') {
      importData.mutate(
        { data: makeDemoData(), mode: 'replace' },
        {
          onSuccess: () => {
            setLocal(null)
            flash('Demo data loaded.')
          },
          onError: flashError,
        },
      )
    } else if (pending === 'import' && replacement) {
      sendImport(replacement.data, 'replace', replacement.unitHint)
    }
    cancel()
  }

  const submitDelete = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const result = DeleteAccountSchema.safeParse({
      password: new FormData(e.currentTarget).get('password'),
    })
    if (!result.success) {
      setPasswordError(result.error.issues[0].message)
      const input = e.currentTarget.elements.namedItem('password')
      if (input instanceof HTMLInputElement) input.focus()
      return
    }
    setPasswordError(undefined)
    deleteAccount.mutate(result.data.password)
  }

  const cancelDelete = () => {
    setIsDeleting(false)
    setPasswordError(undefined)
    deleteAccount.reset()
  }

  return (
    <>
      <PageHead title="Settings" sub="Targets, units and your data." />
      <p role="status" className="toast">
        {msg.isError ? '' : msg.text}
      </p>
      {msg.isError && (
        <p role="alert" className="toast error">
          {msg.text}
        </p>
      )}

      <div className="grid-2">
        <Card title="Targets">
          <QueryState queries={[goalsQuery]} />
          <form onSubmit={save}>
            <div className="form-grid">
              <label>
                Units
                <select
                  value={goals.unit}
                  onChange={(e) => {
                    const unit = e.target.value as Goals['unit']
                    const kg = fromDisplayWeight(goals.targetWeight, goals.unit)
                    setLocal({ ...goals, unit, targetWeight: toDisplayWeight(kg, unit) })
                  }}
                >
                  <option value="kg">kg / cm</option>
                  <option value="lb">lb / in</option>
                </select>
              </label>
              <label>
                Target weight ({goals.unit}){' '}
                <input type="number" step={0.1} {...field('targetWeight')} />
              </label>
              <label>
                Calories (kcal) <input type="number" {...field('calories')} />
              </label>
              <label>
                Protein (g) <input type="number" {...field('protein')} />
              </label>
              <label>
                Carbs (g) <input type="number" {...field('carbs')} />
              </label>
              <label>
                Fat (g) <input type="number" {...field('fat')} />
              </label>
              <label>
                Water (L) <input type="number" step={0.25} {...field('waterL')} />
              </label>
              <label>
                Sleep (h) <input type="number" step={0.25} {...field('sleepHours')} />
              </label>
            </div>
            <p className={`small ${Math.abs(macroKcal - goals.calories) > 100 ? 'warn' : 'muted'}`}>
              Macros add up to {round(macroKcal, 0)} kcal ({macroKcal >= goals.calories ? '+' : ''}
              {round(macroKcal - goals.calories, 0)} vs calorie target).
            </p>
            <div className="actions">
              <button type="submit" disabled={!saved}>
                Save targets
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!latestWeight}
                onClick={suggest}
                title={latestWeight ? '' : 'Log a weigh-in first'}
              >
                Suggest macros from bodyweight
              </button>
            </div>
          </form>
        </Card>

        <Card title="Your data">
          <p className="muted small">
            Everything is stored in your account. Export a backup regularly.
          </p>
          <QueryState queries={[workoutsQuery, foodsQuery, bodyQuery, healthQuery]}>
            <p className="small">
              {workouts.length} workouts · {foods.length} food entries · {body.length} check-ins ·{' '}
              {health.length} health logs
            </p>
          </QueryState>
          <div className="actions">
            <label>
              Import mode
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as ImportMode)}
              >
                <option value="merge">Merge (add new entries)</option>
                <option value="replace">Replace all data</option>
              </select>
            </label>
            <button className="ghost" onClick={doExport}>
              Export backup
            </button>
            <button className="ghost" onClick={() => fileRef.current?.click()}>
              Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={doImport}
            />
          </div>
          <div className="actions">
            <button className="ghost" onClick={() => setPending('demo')}>
              Load demo data
            </button>
            <button className="ghost danger" disabled={!saved} onClick={() => setPending('reset')}>
              Clear all logs
            </button>
          </div>
          {pending && (
            <div className="confirm" role="alertdialog" aria-labelledby={confirmId}>
              <p id={confirmId}>{CONFIRM_TEXT[pending]} This can’t be undone.</p>
              <div className="actions">
                <button
                  className="danger-solid"
                  disabled={pending === 'reset' && !saved}
                  onClick={confirm}
                >
                  Yes, continue
                </button>
                <button className="ghost" autoFocus onClick={cancel}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {exportText && (
            <textarea
              className="export"
              aria-label="Backup JSON"
              rows={6}
              readOnly
              value={exportText}
              onFocus={(e) => e.target.select()}
            />
          )}
        </Card>

        <Card title="Account">
          {isDeleting ? (
            <form className="confirm" onSubmit={submitDelete} noValidate>
              <p>
                Permanently delete your account and all of its data? This can’t be undone. Enter
                your password to confirm.
              </p>
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                error={passwordError}
              />
              {deleteAccount.error && (
                <p role="alert" className="field-error">
                  {errorMessage(deleteAccount.error)}
                </p>
              )}
              <div className="actions">
                <button type="submit" className="danger-solid" disabled={deleteAccount.isPending}>
                  Delete my account
                </button>
                <button type="button" className="ghost" onClick={cancelDelete}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="ghost danger" onClick={() => setIsDeleting(true)}>
              Delete account
            </button>
          )}
        </Card>
      </div>
    </>
  )
}
