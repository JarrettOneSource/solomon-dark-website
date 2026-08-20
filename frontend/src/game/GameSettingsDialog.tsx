import type { GameSettings } from './game-settings.ts'

interface GameSettingsDialogProps {
  onChange: (settings: GameSettings) => void
  onClose: () => void
  settings: GameSettings
}

export default function GameSettingsDialog({
  onChange,
  onClose,
  settings,
}: GameSettingsDialogProps) {
  return (
    <div
      className="game-settings-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <section
        aria-labelledby="game-settings-title"
        aria-modal="true"
        className="game-settings-dialog"
        role="dialog"
      >
        <h2 id="game-settings-title">Settings</h2>
        <label className="game-settings-toggle">
          <input
            autoFocus
            checked={settings.enableCheats}
            onChange={(event) => onChange({ enableCheats: event.target.checked })}
            type="checkbox"
          />
          <span>
            <strong>Enable Cheats</strong>
            <small>Allow the session host to execute bounded Lua from browser DevTools.</small>
          </span>
        </label>
        {settings.enableCheats ? (
          <p className="game-settings-console-help" role="status">
            After entering a game as host, use <code>solomonDark.lua.help()</code> or{' '}
            <code>await solomonDark.lua.execute('return sd.player.get_state()')</code>.
          </p>
        ) : null}
        <button className="game-settings-close" onClick={onClose} type="button">
          Done
        </button>
      </section>
    </div>
  )
}
