import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { gameSettings as settingsAssets } from '../lib/assets.ts'
import {
  GAME_FULLSCREEN_CHANGE_EVENTS,
  gameFullscreenActive,
  gameFullscreenControlMode,
  gameInstalledDisplayMode,
  toggleGameFullscreen,
} from './game-fullscreen.ts'
import {
  CAMERA_FOV_MAX_PERCENT,
  CAMERA_FOV_MIN_PERCENT,
  GAME_BINDING_ACTIONS,
  LIGHT_QUALITY_MAX_PERCENT,
  LIGHT_QUALITY_MIN_PERCENT,
  UI_SCALE_MAX_PERCENT,
  UI_SCALE_MIN_PERCENT,
  gameBindingLabel,
  rebindGameControl,
  type GameBindingAction,
  type GameSettings,
} from './game-settings.ts'
import {
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
  nativeWeldBuild,
} from './core-kernels/player-progression.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import { NativeSkillIcon } from './SkillQuickbar.tsx'

export type GameSettingsContext = 'dark-cloud' | 'gameplay' | 'title'
type SettingsPage = 'controls' | 'performance' | 'primary' | 'concentration' | 'root'

interface GameSettingsDialogProps {
  context: GameSettingsContext
  onChange: (settings: GameSettings) => void
  onClose: () => void
  onSelectConcentration?: (skillId: number) => void
  onSelectPrimarySkill?: (skillId: number) => void
  progression?: ProtocolPlayerProgression
  settings: GameSettings
}

const BINDING_GROUPS = Object.freeze([
  Object.freeze({
    label: 'WIZARD CONTROLS',
    rows: Object.freeze([
      ['moveUp', 'MOVE UP'],
      ['moveDown', 'MOVE DOWN'],
      ['moveLeft', 'MOVE LEFT'],
      ['moveRight', 'MOVE RIGHT'],
    ] as const),
  }),
  Object.freeze({
    label: 'STATS AND STUFF',
    rows: Object.freeze([
      ['openMenu', 'OPEN MENU'],
      ['openInventory', 'OPEN INVENTORY'],
      ['openSkills', 'OPEN SKILLS'],
      ['openChat', 'OPEN CHAT'],
    ] as const),
  }),
  Object.freeze({
    label: 'BELT HOTKEYS',
    rows: Object.freeze(GAME_BINDING_ACTIONS.slice(8).map((action, index) => (
      [action, `BELT SLOT ${index + 1}`] as const
    ))),
  }),
])

export default function GameSettingsDialog({
  context,
  onChange,
  onClose,
  onSelectConcentration,
  onSelectPrimarySkill,
  progression,
  settings,
}: GameSettingsDialogProps) {
  const [page, setPage] = useState<SettingsPage>('root')
  const [listening, setListening] = useState<GameBindingAction | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const exposesSkillSelectors = progression !== undefined
    && onSelectConcentration !== undefined
    && onSelectPrimarySkill !== undefined

  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [context, page])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      if (!listening) {
        if (event.code !== settings.controls.openMenu && event.code !== 'Escape') return
        event.preventDefault()
        event.stopImmediatePropagation()
        if (page === 'root') onClose()
        else setPage('root')
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      onChange({
        ...settings,
        controls: rebindGameControl(settings.controls, listening, event.code),
      })
      setListening(null)
    }
    window.addEventListener('keydown', keyDown, { capture: true })
    return () => window.removeEventListener('keydown', keyDown, { capture: true })
  }, [listening, onChange, onClose, page, settings])

  const back = () => {
    if (listening) {
      setListening(null)
      return
    }
    if (page !== 'root') {
      setPage('root')
      return
    }
    onClose()
  }

  return (
    <div className="game-settings-backdrop" role="presentation">
      <section
        aria-labelledby="game-settings-title"
        aria-modal="true"
        className="game-settings-dialog"
        data-settings-context={context}
        data-settings-page={page}
        onContextMenu={(event) => {
          if (listening) event.preventDefault()
        }}
        onPointerDown={(event) => captureMouseBinding(
          event,
          listening,
          settings,
          onChange,
          setListening,
        )}
        role="dialog"
        style={{
          '--settings-control-panel-atlas': `url("${settingsAssets.controlPanelAtlas}")`,
          '--settings-ui-atlas': `url("${settingsAssets.uiAtlas}")`,
        } as CSSProperties}
      >
        <NativePanelArt />
        <header className="game-settings-header">
          <h2 id="game-settings-title">{pageTitle(page)}</h2>
        </header>
        <div ref={contentRef} className="game-settings-content">
          {page === 'root' ? (
            <RootSettings
              context={context}
              exposesSkillSelectors={exposesSkillSelectors}
              onChange={onChange}
              onOpen={setPage}
              settings={settings}
            />
          ) : page === 'controls' ? (
            <ControlsSettings
              listening={listening}
              onListen={setListening}
              settings={settings}
            />
          ) : page === 'performance' ? (
            <PerformanceSettings onChange={onChange} settings={settings} />
          ) : exposesSkillSelectors ? (
            <NativeSkillSelector
              kind={page}
              onSelect={(skillId) => {
                if (page === 'primary') onSelectPrimarySkill(skillId)
                else onSelectConcentration(skillId)
                setPage('root')
              }}
              progression={progression}
            />
          ) : null}
        </div>
        <button
          className="game-settings-close"
          data-game-back="true"
          onClick={page === 'root' ? onClose : back}
          type="button"
        >
          {page === 'root' ? 'DONE' : 'BACK'}
        </button>
      </section>
    </div>
  )
}

function RootSettings({
  context,
  exposesSkillSelectors,
  onChange,
  onOpen,
  settings,
}: {
  context: GameSettingsContext
  exposesSkillSelectors: boolean
  onChange: (settings: GameSettings) => void
  onOpen: (page: SettingsPage) => void
  settings: GameSettings
}) {
  return (
    <>
      <SettingsGroup title="SOUND AND MUSIC">
        <SettingsRange
          autoFocus
          label="SOUND VOL:"
          maximum={100}
          minimum={0}
          onChange={(soundVolumePercent) => onChange({ ...settings, soundVolumePercent })}
          value={settings.soundVolumePercent}
        />
        <SettingsRange
          label="MUSIC VOL:"
          maximum={100}
          minimum={0}
          onChange={(musicVolumePercent) => onChange({ ...settings, musicVolumePercent })}
          value={settings.musicVolumePercent}
        />
      </SettingsGroup>

      <SettingsGroup title="VIDEO SETTINGS">
        <FullscreenSetting />
        <SettingsRange
          label="CAMERA FOV"
          maximum={CAMERA_FOV_MAX_PERCENT}
          minimum={CAMERA_FOV_MIN_PERCENT}
          onChange={(cameraFovPercent) => onChange({ ...settings, cameraFovPercent })}
          value={settings.cameraFovPercent}
        />
        <SettingsRange
          label="UI SCALE"
          maximum={UI_SCALE_MAX_PERCENT}
          minimum={UI_SCALE_MIN_PERCENT}
          onChange={(uiScalePercent) => onChange({ ...settings, uiScalePercent })}
          value={settings.uiScalePercent}
        />
      </SettingsGroup>

      <SettingsGroup title="CONTROLS">
        <SettingsAction label="CUSTOMIZE KEYBOARD" onClick={() => onOpen('controls')} />
      </SettingsGroup>

      <SettingsGroup title="PERFORMANCE">
        <SettingsAction label="TWEAK GAME" onClick={() => onOpen('performance')} />
      </SettingsGroup>

      {exposesSkillSelectors ? (
        <SettingsGroup title="SPELL LOADOUT">
          <SettingsAction label="SELECT PRIMARY ATTACK" onClick={() => onOpen('primary')} />
          <SettingsAction label="SELECT CONCENTRATION" onClick={() => onOpen('concentration')} />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="DEVELOPER">
        <SettingsToggle
          checked={settings.enableCheats}
          label="ENABLE CHEATS"
          onChange={(enableCheats) => onChange({ ...settings, enableCheats })}
        />
        {settings.enableCheats ? (
          <p className="game-settings-console-help" role="status">
            Host console: <code>solomonDark.lua.help()</code>
          </p>
        ) : null}
      </SettingsGroup>

      {context !== 'title' ? (
        <p className="game-settings-context-note">
          Display size follows the browser. Resolution is available automatically.
        </p>
      ) : null}
    </>
  )
}

function ControlsSettings({
  listening,
  onListen,
  settings,
}: {
  listening: GameBindingAction | null
  onListen: (action: GameBindingAction | null) => void
  settings: GameSettings
}) {
  return (
    <div className="game-settings-controls">
      {BINDING_GROUPS.map((group) => (
        <SettingsGroup key={group.label} title={group.label}>
          {group.rows.map(([action, label]) => (
            <button
              aria-label={`${label}, ${gameBindingLabel(settings.controls[action])}`}
              aria-pressed={listening === action}
              className="game-settings-binding"
              data-binding-action={action}
              data-binding-code={settings.controls[action]}
              key={action}
              onClick={() => onListen(listening === action ? null : action)}
              type="button"
            >
              <span>{label}</span>
              <strong>{listening === action ? 'PRESS A KEY' : gameBindingLabel(settings.controls[action])}</strong>
            </button>
          ))}
        </SettingsGroup>
      ))}
    </div>
  )
}

function PerformanceSettings({
  onChange,
  settings,
}: {
  onChange: (settings: GameSettings) => void
  settings: GameSettings
}) {
  return (
    <>
      <SettingsGroup title="LIGHTING">
        <SettingsToggle
          checked={settings.complexLighting}
          label="COMPLEX LIGHTING"
          onChange={(complexLighting) => onChange({ ...settings, complexLighting })}
        />
        <SettingsToggle
          checked={settings.complexShadows}
          label="COMPLEX SHADOWS"
          onChange={(complexShadows) => onChange({ ...settings, complexShadows })}
        />
        <SettingsToggle
          checked={settings.multipleShadows}
          label="MULTIPLE SHADOWS"
          onChange={(multipleShadows) => onChange({ ...settings, multipleShadows })}
        />
        <SettingsRange
          label="LIGHT QUALITY"
          maximum={LIGHT_QUALITY_MAX_PERCENT}
          minimum={LIGHT_QUALITY_MIN_PERCENT}
          onChange={(lightQualityPercent) => onChange({ ...settings, lightQualityPercent })}
          value={settings.lightQualityPercent}
        />
      </SettingsGroup>
      <SettingsGroup title="PLAY STYLE">
        <SettingsToggle
          checked={settings.castSecondariesAtMouse}
          label="CAST SECONDARY SPELLS AT MOUSE"
          onChange={(castSecondariesAtMouse) => onChange({
            ...settings,
            castSecondariesAtMouse,
          })}
        />
      </SettingsGroup>
      <SettingsGroup title="SPECIAL EFFECTS">
        <SettingsToggle
          checked={settings.zoomEffects}
          label="ZOOM EFFECTS"
          onChange={(zoomEffects) => onChange({ ...settings, zoomEffects })}
        />
        <p className="game-settings-fixed-policy">
          ENHANCED EFFECTS: ON
          <small>Fixed for synchronized multiplayer presentation.</small>
        </p>
      </SettingsGroup>
    </>
  )
}

function SettingsGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="game-settings-group" aria-label={title}>
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  )
}

function SettingsRange({
  autoFocus = false,
  label,
  maximum,
  minimum,
  onChange,
  value,
}: {
  autoFocus?: boolean
  label: string
  maximum: number
  minimum: number
  onChange: (value: number) => void
  value: number
}) {
  return (
    <label className="game-settings-range">
      <span>{label}</span>
      <input
        autoFocus={autoFocus}
        aria-valuetext={`${value}%`}
        data-game-default-focus={autoFocus ? 'true' : undefined}
        max={maximum}
        min={minimum}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        step={1}
        type="range"
        value={value}
      />
      <output>{value}%</output>
    </label>
  )
}

function SettingsToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      aria-pressed={checked}
      className="game-settings-native-toggle-row"
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span>{label}</span>
      <i className="game-settings-native-toggle" data-enabled={checked} aria-hidden />
    </button>
  )
}

function SettingsAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="game-settings-action" onClick={onClick} type="button">
      <span>{label}</span>
      <i aria-hidden />
    </button>
  )
}

function FullscreenSetting() {
  const [active, setActive] = useState(() => gameFullscreenActive(document))
  const [error, setError] = useState<string | null>(null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [installed] = useState(() => gameInstalledDisplayMode(window))
  const mode = gameFullscreenControlMode(document, installed)

  useEffect(() => {
    const update = () => {
      setActive(gameFullscreenActive(document))
      setError(null)
      setShowInstallHelp(false)
    }
    for (const eventName of GAME_FULLSCREEN_CHANGE_EVENTS) {
      document.addEventListener(eventName, update)
    }
    return () => {
      for (const eventName of GAME_FULLSCREEN_CHANGE_EVENTS) {
        document.removeEventListener(eventName, update)
      }
    }
  }, [])

  if (mode === 'hidden') return null
  const toggle = async () => {
    setError(null)
    if (mode === 'install') {
      setShowInstallHelp((visible) => !visible)
      return
    }
    try {
      await toggleGameFullscreen(document)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Fullscreen could not be changed.')
    }
  }
  return (
    <div className="game-settings-fullscreen">
      <button
        aria-expanded={mode === 'install' ? showInstallHelp : undefined}
        aria-pressed={mode === 'fullscreen' ? active : undefined}
        className="game-settings-native-toggle-row"
        data-settings-fullscreen
        onClick={() => { void toggle() }}
        type="button"
      >
        <span>FULLSCREEN</span>
        {mode === 'install' ? <strong>OPTIONS</strong> : (
          <i className="game-settings-native-toggle" data-enabled={active} aria-hidden />
        )}
      </button>
      {showInstallHelp ? (
        <small role="status">Install this page as a web app for fullscreen on iPhone or iPad.</small>
      ) : null}
      {error ? <small role="alert">{error}</small> : null}
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

function NativePanelArt() {
  return (
    <div className="game-settings-native-art" aria-hidden>
      <i className="game-settings-frame-corner top-left" />
      <i className="game-settings-frame-corner top-right" />
      <i className="game-settings-frame-corner bottom-left" />
      <i className="game-settings-frame-corner bottom-right" />
      <i className="game-settings-frame-flourish left" />
      <i className="game-settings-frame-flourish right" />
    </div>
  )
}

function captureMouseBinding(
  event: ReactPointerEvent<HTMLElement>,
  listening: GameBindingAction | null,
  settings: GameSettings,
  onChange: (settings: GameSettings) => void,
  setListening: (action: GameBindingAction | null) => void,
) {
  if (!listening || !listening.startsWith('belt') || event.pointerType !== 'mouse') return
  if (event.button < 1) return
  event.preventDefault()
  event.stopPropagation()
  onChange({
    ...settings,
    controls: rebindGameControl(settings.controls, listening, `Mouse${event.button}`),
  })
  setListening(null)
}

function pageTitle(page: SettingsPage): string {
  if (page === 'controls') return 'CUSTOMIZE KEYBOARD'
  if (page === 'performance') return 'TWEAK PERFORMANCE'
  if (page === 'primary') return 'SELECT PRIMARY ATTACK'
  if (page === 'concentration') return 'SELECT CONCENTRATION'
  return 'GAME SETTINGS'
}
