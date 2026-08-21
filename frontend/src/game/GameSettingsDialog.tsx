import type { GameSettings } from './game-settings.ts'
import {
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
  nativeWeldBuild,
} from './core-kernels/player-progression.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import { NativeSkillIcon } from './SkillQuickbar.tsx'

interface GameSettingsDialogProps {
  onChange: (settings: GameSettings) => void
  onClose: () => void
  onSelectConcentration?: (skillId: number) => void
  onSelectPrimarySkill?: (skillId: number) => void
  progression?: ProtocolPlayerProgression
  settings: GameSettings
}

export default function GameSettingsDialog({
  onChange,
  onClose,
  onSelectConcentration,
  onSelectPrimarySkill,
  progression,
  settings,
}: GameSettingsDialogProps) {
  const exposesSkillSelectors = progression !== undefined
    && onSelectConcentration !== undefined
    && onSelectPrimarySkill !== undefined
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
        className={`game-settings-dialog${exposesSkillSelectors
          ? ' game-settings-dialog-gameplay'
          : ''}`}
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
        {exposesSkillSelectors ? (
          <div className="game-settings-skill-selectors">
            <NativeSkillSelector
              kind="primary"
              onSelect={onSelectPrimarySkill}
              progression={progression}
            />
            <NativeSkillSelector
              kind="concentration"
              onSelect={onSelectConcentration}
              progression={progression}
            />
          </div>
        ) : null}
        <button className="game-settings-close" onClick={onClose} type="button">
          Done
        </button>
      </section>
    </div>
  )
}

function NativeSkillSelector({
  kind,
  onSelect,
  progression,
}: {
  kind: 'concentration' | 'primary'
  onSelect: (skillId: number) => void
  progression: ProtocolPlayerProgression
}) {
  const rows = progression.learnedSkillOrder.flatMap((skillId) => {
    if (nativeSkillCategory(skillId) !== (kind === 'primary' ? 1 : 3)) return []
    const skill = NATIVE_SKILL_CATALOG[skillId]
    if (!skill || (skillId === 52 && progression.weldBuildId === null)) return []
    const weld = skillId === 52 ? nativeWeldBuild(progression.weldBuildId!) : null
    return [{
      iconRecord: weld?.skillsAtlasIconRecord ?? skill.skills_atlas_icon_record,
      name: skill.name,
      selected: kind === 'primary'
        ? progression.selectedPrimarySkillId === skillId
        : progression.concentrationSkillIds.includes(skillId),
      skillId,
    }]
  })
  const title = kind === 'primary' ? 'Select Primary Attack' : 'Select Concentration'
  return (
    <section className="game-settings-skill-selector" aria-label={title}>
      <h3>{title}</h3>
      <div className="game-settings-skill-options">
        {rows.length === 0 ? (
          <p>No learned {kind === 'primary' ? 'primary attacks' : 'concentrations'}.</p>
        ) : rows.map((row) => (
          <button
            key={row.skillId}
            type="button"
            aria-label={`${row.name}${row.selected ? ', selected' : ''}`}
            aria-pressed={row.selected}
            data-skill-id={row.skillId}
            disabled={kind === 'concentration' && progression.mindChugTicksRemaining > 0}
            onClick={() => onSelect(row.skillId)}
          >
            <NativeSkillIcon cooldown={false} record={row.iconRecord} />
            <span>{row.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
