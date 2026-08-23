import type { CSSProperties } from 'react'

import type { GameSaveModMismatch } from './save/game-save-mods.ts'
import './game-save-mod-mismatch.css'

export default function GameSaveModMismatchDialog({
  mismatch,
  onCancel,
  onContinue,
  style,
}: {
  mismatch: GameSaveModMismatch
  onCancel: () => void
  onContinue: () => void
  style: CSSProperties
}) {
  return (
    <div className="main-menu-native-stage game-save-mod-mismatch-stage" style={style}>
      <section className="game-save-mod-mismatch" role="dialog" aria-modal="true" aria-label="Saved mod list changed">
        <h2>THE MOD LIST HAS CHANGED</h2>
        <p>This save was made with a different Dark Cloud. Continue with the currently enabled mods?</p>
        <div className="game-save-mod-mismatch-groups">
          {mismatch.added.length ? (
            <MismatchGroup title="ADDED" items={mismatch.added.map(mod => `${mod.id} v${mod.version}`)} />
          ) : null}
          {mismatch.removed.length ? (
            <MismatchGroup title="MISSING" items={mismatch.removed.map(mod => `${mod.id} v${mod.version}`)} />
          ) : null}
          {mismatch.changed.length ? (
            <MismatchGroup
              title="CHANGED"
              items={mismatch.changed.map(({ active, saved }) => (
                `${saved.id} v${saved.version} → v${active.version}`
              ))}
            />
          ) : null}
        </div>
        <p className="game-save-mod-mismatch-warning">
          Missing or changed mod state will be discarded. If the save is inside a missing mod Boneyard, the wizard returns to the College.
        </p>
        <div className="game-save-mod-mismatch-actions">
          <button data-game-back="true" type="button" onClick={onCancel}>CANCEL</button>
          <button type="button" onClick={onContinue}>CONTINUE</button>
        </div>
      </section>
    </div>
  )
}

function MismatchGroup({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section>
      <h3>{title}</h3>
      <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>
    </section>
  )
}
