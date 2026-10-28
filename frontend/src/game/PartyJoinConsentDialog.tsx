import type { PartyJoinTarget } from '../lib/api.ts'
import type { GameContentDownloadProgress } from './game-content-cache.ts'
import { DownloadProgress } from './ModdedPlayDialog.tsx'
import './play-routing-dialog.css'

export default function PartyJoinConsentDialog({
  busy,
  onBack,
  onContinue,
  progress,
  requiresVanilla,
  signedIn,
  target,
}: {
  busy: boolean
  onBack: () => void
  onContinue: () => void
  progress: GameContentDownloadProgress | null
  requiresVanilla: boolean
  signedIn: boolean
  target: PartyJoinTarget
}) {
  const modded = target.content.mods.length > 0
  const cheats = target.cheatsEnabled
  return (
    <div className="play-routing-backdrop" role="presentation">
      <section className="play-routing-dialog" role="dialog" aria-modal="true" aria-label="Join party consent">
        <h2>{target.leader.toUpperCase()}'S COLLEGE</h2>
        <p>
          {target.kind === 'global-hub'
            ? 'This is a vanilla global-Hub party.'
            : 'The room decides its content and cheat policy. Your unrelated mods and settings are ignored for this session.'}
        </p>
        {modded ? (
          <div>
            <h3>{target.content.mods.length} {target.content.mods.length === 1 ? 'MOD' : 'MODS'}</h3>
            <ul>{target.content.mods.map(mod => (
              <li key={mod.id}>{mod.name} · v{mod.version}</li>
            ))}</ul>
          </div>
        ) : null}
        {cheats ? (
          <p className="play-routing-warning">CHEATS ENABLED FOR THIS COLLEGE</p>
        ) : null}
        {target.kind === 'private-college' ? (
          <p className="play-routing-warning">LOCAL HALL ONLY · GLOBAL SCORES OFF</p>
        ) : null}
        {requiresVanilla ? (
          <p className="play-routing-warning">ACTIVE MODS AND CHEATS WILL BE DISABLED</p>
        ) : null}
        <DownloadProgress progress={progress} />
        <footer>
          <button data-game-back="true" disabled={busy} type="button" onClick={onBack}>BACK</button>
          <button disabled={busy} type="button" onClick={onContinue}>
            {busy
              ? 'PREPARING…'
                : requiresVanilla
                  ? 'DISABLE & JOIN'
                : modded
                ? signedIn ? 'SYNC MODS & JOIN' : 'DOWNLOAD & JOIN ONCE'
                : 'JOIN PARTY'}
          </button>
        </footer>
      </section>
    </div>
  )
}
