import { useEffect, useState } from 'react'
import { desktopRuntime, type DesktopState } from './desktop-runtime.ts'
import './desktop-update-notice.css'

export default function DesktopUpdateNotice() {
  const desktop = desktopRuntime()
  const [state, setState] = useState<DesktopState | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  useEffect(() => {
    if (!desktop) return
    let active = true
    void desktop.getState().then(next => { if (active) setState(next) })
    const remove = desktop.onState(setState)
    return () => { active = false; remove() }
  }, [desktop])
  if (!desktop || !state?.update || state.update.revision === dismissed) return null
  return <aside className="desktop-update-notice" role="status">
    <span>A Solomon Darker update is available.</span>
    <button onClick={() => { void desktop.downloadUpdate() }}>Download update</button>
    <button onClick={() => setDismissed(state.update?.revision ?? null)}>Later</button>
  </aside>
}
