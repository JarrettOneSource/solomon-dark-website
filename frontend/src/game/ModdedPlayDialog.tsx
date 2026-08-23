import type { ActiveWebMod } from '../lib/api.ts'
import type { GameContentDownloadProgress } from './game-content-cache.ts'
import './play-routing-dialog.css'

export default function ModdedPlayDialog({
  activeMods,
  busy,
  cheatsEnabled,
  onBack,
  onContinueLocal,
  onPlayVanilla,
  progress,
}: {
  activeMods: readonly ActiveWebMod[]
  busy: boolean
  cheatsEnabled: boolean
  onBack: () => void
  onContinueLocal: () => void
  onPlayVanilla: () => void
  progress: GameContentDownloadProgress | null
}) {
  return (
    <div className="play-routing-backdrop" role="presentation">
      <section className="play-routing-dialog" role="dialog" aria-modal="true" aria-label="Local play is active">
        <h2>LOCAL PLAY IS ACTIVE</h2>
        <p>Mods and cheats use a private College. These runs stay in your local Hall of Fame.</p>
        {activeMods.length > 0 ? (
          <div>
            <h3>ACTIVE MODS</h3>
            <ul>{activeMods.map(mod => <li key={mod.id}>{mod.name} · v{mod.version}</li>)}</ul>
          </div>
        ) : null}
        {cheatsEnabled ? <p className="play-routing-warning">CHEATS ENABLED</p> : null}
        <DownloadProgress progress={progress} />
        <footer>
          <button data-game-back="true" disabled={busy} type="button" onClick={onBack}>BACK</button>
          <button disabled={busy} type="button" onClick={onPlayVanilla}>
            {activeMods.length > 0 && cheatsEnabled
              ? 'DISABLE MODS & CHEATS'
              : activeMods.length > 0 ? 'DISABLE ALL MODS' : 'DISABLE CHEATS'}
          </button>
          <button disabled={busy} type="button" onClick={onContinueLocal}>
            {busy ? 'PREPARING…' : 'CONTINUE LOCAL'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function DownloadProgress({ progress }: { progress: GameContentDownloadProgress | null }) {
  if (!progress || progress.totalBytes === 0) return null
  const percent = Math.min(100, Math.round(progress.completedBytes / progress.totalBytes * 100))
  return (
    <div className="play-routing-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ width: `${percent}%` }} />
      <small>{progress.active ? `Downloading ${progress.active.modId}` : 'Content ready'} · {percent}%</small>
    </div>
  )
}
