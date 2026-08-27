import {
  useCallback,
  useEffect,
  lazy,
  Suspense,
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
  DEFAULT_MOBILE_UI_LAYOUT,
  defaultMobileUiGeometry,
  mobileUiEditorPageSize,
  readMobileUiLayoutState,
  resetMobileUiLayout,
  setMobileUiLayout,
  type MobileUiLayout,
  type MobileUiSize,
} from './mobile-ui-layout.ts'
export type GameSettingsContext = 'dark-cloud' | 'gameplay' | 'title'
type SettingsPage = 'controls' | 'mobile-ui' | 'performance' | 'root'

const MobileUiEditor = lazy(() => import('./MobileUiEditor.tsx'))

interface GameSettingsDialogProps {
  context: GameSettingsContext
  onChange: (settings: GameSettings) => void
  onClose: () => void
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
  settings,
}: GameSettingsDialogProps) {
  const [page, setPage] = useState<SettingsPage>('root')
  const [listening, setListening] = useState<GameBindingAction | null>(null)
  const [mobileUiDraft, setMobileUiDraft] = useState<MobileUiLayout>(DEFAULT_MOBILE_UI_LAYOUT)
  const [mobileUiPage, setMobileUiPage] = useState<MobileUiSize>({ height: 414, width: 896 })
  const [mobileUiRestoringDefault, setMobileUiRestoringDefault] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  const commitMobileUi = useCallback(() => {
    if (mobileUiRestoringDefault) resetMobileUiLayout()
    else setMobileUiLayout(mobileUiDraft)
  }, [mobileUiDraft, mobileUiRestoringDefault])

  const openMobileUi = () => {
    const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    const stage = document.querySelector<HTMLElement>('.main-menu-stage')?.getBoundingClientRect()
    const editorPage = mobileUiEditorPageSize(
      stage?.width ?? window.innerWidth,
      stage?.height ?? window.innerHeight,
      coarsePointer,
    )
    const stored = readMobileUiLayoutState()
    setMobileUiPage(editorPage)
    setMobileUiDraft(stored.customized
      ? stored.layout
      : defaultMobileUiGeometry(
          editorPage.width,
          editorPage.height,
          settings.uiScalePercent / 100,
        ).layout)
    setMobileUiRestoringDefault(!stored.customized)
    setPage('mobile-ui')
  }

  const leaveSubpage = useCallback(() => {
    if (page === 'mobile-ui') commitMobileUi()
    setPage('root')
  }, [commitMobileUi, page])

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
        else leaveSubpage()
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
  }, [leaveSubpage, listening, onChange, onClose, page, settings])

  const back = () => {
    if (listening) {
      setListening(null)
      return
    }
    if (page !== 'root') {
      leaveSubpage()
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
              onChange={onChange}
              onOpen={(nextPage) => {
                if (nextPage === 'mobile-ui') openMobileUi()
                else setPage(nextPage)
              }}
              settings={settings}
            />
          ) : page === 'controls' ? (
            <ControlsSettings
              listening={listening}
              onListen={setListening}
              settings={settings}
            />
          ) : page === 'mobile-ui' ? (
            <Suspense fallback={<p className="game-settings-context-note" role="status">Opening editor…</p>}>
              <MobileUiEditor
                layout={mobileUiDraft}
                onChange={(layout) => {
                  setMobileUiDraft(layout)
                  setMobileUiRestoringDefault(false)
                }}
                onReset={() => {
                  setMobileUiDraft(defaultMobileUiGeometry(
                    mobileUiPage.width,
                    mobileUiPage.height,
                    settings.uiScalePercent / 100,
                  ).layout)
                  setMobileUiRestoringDefault(true)
                }}
                page={mobileUiPage}
                restoringDefault={mobileUiRestoringDefault}
                uiScale={settings.uiScalePercent / 100}
              />
            </Suspense>
          ) : (
            <PerformanceSettings onChange={onChange} settings={settings} />
          )}
        </div>
        <button
          className="game-settings-close"
          data-game-back="true"
          onClick={page === 'root' ? onClose : back}
          type="button"
        >
          {page === 'root' ? 'DONE' : page === 'mobile-ui' ? 'SAVE' : 'BACK'}
        </button>
      </section>
    </div>
  )
}

function RootSettings({
  context,
  onChange,
  onOpen,
  settings,
}: {
  context: GameSettingsContext
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
        <SettingsAction label="CUSTOMIZE MOBILE UI" onClick={() => onOpen('mobile-ui')} />
      </SettingsGroup>

      <SettingsGroup title="PERFORMANCE">
        <SettingsAction label="TWEAK GAME" onClick={() => onOpen('performance')} />
      </SettingsGroup>

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
          label="CAMERA SHAKE"
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
  if (page === 'mobile-ui') return 'MOBILE UI EDITOR'
  if (page === 'performance') return 'TWEAK PERFORMANCE'
  return 'GAME SETTINGS'
}
