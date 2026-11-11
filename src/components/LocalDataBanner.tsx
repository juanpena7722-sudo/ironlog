import { useState } from 'react'
import { errorMessage } from '../api/auth'
import { normalize, useImportData } from '../store'
import type { AppData } from '../types'

const LOCAL_DATA_KEY = 'ironlog:data'
const DISMISSED_KEY = 'ironlog:local-import-dismissed'

// Data from the browser-only version. Goals alone are skipped: a merge import never changes goals.
function readLocalData(): AppData | null {
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return null
    const raw = localStorage.getItem(LOCAL_DATA_KEY)
    if (!raw) return null
    const data = normalize(JSON.parse(raw) as Partial<AppData>)
    const hasEntries = [data.workouts, data.foods, data.body, data.health].some((c) => c.length)
    return hasEntries ? data : null
  } catch {
    return null
  }
}

export default function LocalDataBanner() {
  const [data, setData] = useState(readLocalData)
  const importData = useImportData()

  if (!data) return null

  const importLocal = () =>
    // The browser-only version stored weights and lengths in the display unit.
    importData.mutate(
      { data, mode: 'merge', unitHint: data.goals.unit },
      {
        onSuccess: () => {
          localStorage.removeItem(LOCAL_DATA_KEY)
          setData(null)
        },
      },
    )

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setData(null)
  }

  return (
    <section className="card" aria-label="Import data from this browser">
      <p>
        This browser has IronLog data from before you had an account. Import it into your account?
      </p>
      {importData.error && (
        <p role="alert" className="field-error">
          {errorMessage(importData.error)}
        </p>
      )}
      <div className="actions">
        <button type="button" disabled={importData.isPending} onClick={importLocal}>
          Import local data
        </button>
        <button type="button" className="ghost" disabled={importData.isPending} onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </section>
  )
}
