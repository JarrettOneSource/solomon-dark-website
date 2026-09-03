import {
  useCallback,
  useEffect,
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

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
import type { NativeSaveTransferController } from './NativeSaveTransferSettings.tsx'
import {
  NativeUiSettingsAction,
  NativeUiSettingsBinding,
  NativeUiSettingsGroup,
  NativeUiSettingsPanel,
  NativeUiSettingsRange,
  NativeUiSettingsStaticRow,
  NativeUiSettingsToggle,
  NativeUiSettingsValueAction,
} from './native-ui/react.ts'

export type GameSettingsContext = 'dark-cloud' | 'gameplay' | 'title'
type SettingsPage = 'cloud' | 'controls' | 'mobile-ui' | 'performance' | 'root' | 'save-transfer'

const MobileUiEditor = lazy(() => import('./MobileUiEditor.tsx'))
const MobileUiLayoutSettingsAction = lazy(() => import('./MobileUiLayoutSettingsAction.tsx'))
const NativeSaveTransferSettings = lazy(() => import('./NativeSaveTransferSettings.tsx'))

interface GameSettingsDialogProps {
  accountUsername: string | null
  context: GameSettingsContext
  onChange: (settings: GameSettings) => void
  onClose: () => void
  saveTransfer?: NativeSaveTransferController
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
      ['openCheats', 'OPEN CHEATS'],
    ] as const),
  }),
  Object.freeze({
    label: 'BELT HOTKEYS',
    rows: Object.freeze(GAME_BINDING_ACTIONS.filter((action) => (
      action.startsWith('belt')
    )).map((action, index) => (
      [action, `BELT SLOT ${index + 1}`] as const
    ))),
  }),
])

export default function GameSettingsDialog({
  accountUsername,
  context,
  onChange,
  onClose,
  saveTransfer,
  settings,
}: GameSettingsDialogProps) {
  const [page, setPage] = useState<SettingsPage>('root')
  const [listening, setListening] = useState<GameBindingAction | null>(null)
  const [mobileUiDraft, setMobileUiDraft] = useState<MobileUiLayout>(DEFAULT_MOBILE_UI_LAYOUT)
  const [mobileUiFullscreen, setMobileUiFullscreen] = useState(false)
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
    setMobileUiFullscreen(coarsePointer)
    setPage('mobile-ui')
  }

  const leaveSubpage = useCallback(() => {
    if (page === 'mobile-ui') commitMobileUi()
    setMobileUiFullscreen(false)
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

  const mobileUiEditor = (
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
        onSave={mobileUiFullscreen ? leaveSubpage : undefined}
        page={mobileUiPage}
        presentation={mobileUiFullscreen ? 'fullscreen' : 'windowed'}
        restoringDefault={mobileUiRestoringDefault}
        uiScale={settings.uiScalePercent / 100}
      />
    </Suspense>
  )

  if (page === 'mobile-ui' && mobileUiFullscreen) {
    return (
      <div
        aria-label="Mobile UI Editor"
        aria-modal="true"
        className="game-settings-backdrop game-settings-mobile-ui-fullscreen"
        role="dialog"
      >
        {mobileUiEditor}
      </div>
    )
  }

  const footerLabel = page === 'root' ? 'DONE' : page === 'mobile-ui' ? 'SAVE' : 'BACK'
  return (
    <NativeUiSettingsPanel
      contentRef={contentRef}
      data-settings-context={context}
      data-settings-page={page}
      footerBack
      footerLabel={footerLabel}
      onContextMenu={(event) => {
        if (listening) event.preventDefault()
      }}
      onFooter={back}
      onPointerDown={(event) => captureMouseBinding(
        event,
        listening,
        settings,
        onChange,
        setListening,
      )}
      title={pageTitle(page)}
    >
      {page === 'root' ? (
            <RootSettings
              onChange={onChange}
              onOpen={(nextPage) => {
                if (nextPage === 'mobile-ui') openMobileUi()
                else setPage(nextPage)
              }}
              settings={settings}
            />
      ) : page === 'cloud' ? (
            <CloudSettings
              accountUsername={accountUsername}
              context={context}
              onChange={onChange}
              onOpen={(nextPage) => {
                if (nextPage === 'mobile-ui') openMobileUi()
                else setPage(nextPage)
              }}
              saveTransfer={saveTransfer}
              settings={settings}
            />
      ) : page === 'controls' ? (
            <ControlsSettings
              listening={listening}
              onListen={setListening}
              settings={settings}
            />
      ) : page === 'mobile-ui' ? (
            mobileUiEditor
      ) : page === 'performance' ? (
            <PerformanceSettings onChange={onChange} settings={settings} />
      ) : saveTransfer ? (
            <Suspense fallback={<p className="game-settings-context-note" role="status">Opening save transfer…</p>}>
              <NativeSaveTransferSettings controller={saveTransfer} />
            </Suspense>
      ) : null}
    </NativeUiSettingsPanel>
  )
}

function RootSettings({
  onChange,
  onOpen,
  settings,
}: {
  onChange: (settings: GameSettings) => void
  onOpen: (page: SettingsPage) => void
  settings: GameSettings
}) {
  return (
    <>
      <NativeUiSettingsGroup title="SOUND AND MUSIC">
        <NativeUiSettingsRange
          autoFocus
          label="SOUND VOL:"
          maximum={100}
          minimum={0}
          onChange={(soundVolumePercent) => onChange({ ...settings, soundVolumePercent })}
          value={settings.soundVolumePercent}
        />
        <NativeUiSettingsRange
          label="MUSIC VOL:"
          maximum={100}
          minimum={0}
          onChange={(musicVolumePercent) => onChange({ ...settings, musicVolumePercent })}
          value={settings.musicVolumePercent}
        />
      </NativeUiSettingsGroup>

      <NativeUiSettingsGroup title="VIDEO SETTINGS">
        <FullscreenSetting />
        <NativeUiSettingsRange
          label="CAMERA FOV"
          maximum={CAMERA_FOV_MAX_PERCENT}
          minimum={CAMERA_FOV_MIN_PERCENT}
          onChange={(cameraFovPercent) => onChange({ ...settings, cameraFovPercent })}
          value={settings.cameraFovPercent}
        />
        <NativeUiSettingsRange
          label="UI SCALE"
          maximum={UI_SCALE_MAX_PERCENT}
          minimum={UI_SCALE_MIN_PERCENT}
          onChange={(uiScalePercent) => onChange({ ...settings, uiScalePercent })}
          value={settings.uiScalePercent}
        />
      </NativeUiSettingsGroup>

      <NativeUiSettingsGroup title="DARK CLOUD SETTINGS">
        <NativeUiSettingsAction label="ONLINE AND ACCOUNT" onClick={() => onOpen('cloud')} />
      </NativeUiSettingsGroup>

      <NativeUiSettingsGroup title="CONTROLS">
        <NativeUiSettingsAction label="CUSTOMIZE KEYBOARD" onClick={() => onOpen('controls')} />
      </NativeUiSettingsGroup>

      <NativeUiSettingsGroup title="PERFORMANCE">
        <NativeUiSettingsAction label="TWEAK GAME" onClick={() => onOpen('performance')} />
      </NativeUiSettingsGroup>
    </>
  )
}

function CloudSettings({
  accountUsername,
  context,
  onChange,
  onOpen,
  saveTransfer,
  settings,
}: {
  accountUsername: string | null
  context: GameSettingsContext
  onChange: (settings: GameSettings) => void
  onOpen: (page: SettingsPage) => void
  saveTransfer?: NativeSaveTransferController
  settings: GameSettings
}) {
  const onlineFeatures = settings.enableOnlineFeatures
  const globalChat = onlineFeatures && settings.enableGlobalChat
  return (
    <>
      <NativeUiSettingsGroup title="DARK ACCOUNT">
        <NativeUiSettingsStaticRow label={`ACCOUNT: ${(accountUsername ?? 'GUEST').toUpperCase()}`} />
      </NativeUiSettingsGroup>

      <NativeUiSettingsGroup title="ONLINE FEATURES">
        <NativeUiSettingsToggle
          autoFocus
          checked={onlineFeatures}
          label="ENABLE ONLINE FEATURES"
          onChange={(enableOnlineFeatures) => onChange({ ...settings, enableOnlineFeatures })}
        />
        <NativeUiSettingsToggle
          checked={globalChat && settings.enableActivityMessages}
          disabled={!globalChat}
          label="ENABLE ACTIVITY MESSAGES"
          nested
          onChange={(enableActivityMessages) => onChange({
            ...settings,
            enableActivityMessages,
          })}
        />
        <NativeUiSettingsToggle
          checked={globalChat}
          disabled={!onlineFeatures}
          label="ENABLE GLOBAL CHAT"
          nested
          onChange={(enableGlobalChat) => onChange({ ...settings, enableGlobalChat })}
        />
        <NativeUiSettingsToggle
          checked={onlineFeatures && settings.enableSharedHub}
          disabled={!onlineFeatures}
          label="ENABLE SHARED HUB"
          nested
          onChange={(enableSharedHub) => onChange({ ...settings, enableSharedHub })}
        />
        <NativeUiSettingsToggle
          checked={onlineFeatures && settings.submitRunsToServer}
          disabled={!onlineFeatures}
          label="SUBMIT RUNS TO SERVER"
          nested
          onChange={(submitRunsToServer) => onChange({ ...settings, submitRunsToServer })}
        />
      </NativeUiSettingsGroup>

      <NativeUiSettingsGroup title="MOBILE INTERFACE">
        <NativeUiSettingsAction label="CUSTOMIZE MOBILE UI" onClick={() => onOpen('mobile-ui')} />
        <Suspense fallback={null}>
          <MobileUiLayoutSettingsAction accountUsername={accountUsername} />
        </Suspense>
      </NativeUiSettingsGroup>

      {context === 'title' && saveTransfer ? (
        <NativeUiSettingsGroup title="SAVE TRANSFER">
          <NativeUiSettingsAction label="STOCK / BROWSER SAVE" onClick={() => onOpen('save-transfer')} />
        </NativeUiSettingsGroup>
      ) : null}

      <NativeUiSettingsGroup title="DEVELOPER">
        <NativeUiSettingsToggle
          checked={settings.enableCheats}
          label="ENABLE CHEATS"
          onChange={(enableCheats) => onChange({ ...settings, enableCheats })}
        />
        {settings.enableCheats ? (
          <p className="game-settings-console-help" role="status">
            Debug menu: <strong>{gameBindingLabel(settings.controls.openCheats)}</strong>
            <br />DevTools: <code>solomonDark.lua.help()</code>
          </p>
        ) : null}
      </NativeUiSettingsGroup>

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
        <NativeUiSettingsGroup key={group.label} title={group.label}>
          {group.rows.map(([action, label]) => (
            <NativeUiSettingsBinding
              aria-pressed={listening === action}
              data-binding-action={action}
              data-binding-code={settings.controls[action]}
              key={action}
              label={label}
              onClick={() => onListen(listening === action ? null : action)}
              value={listening === action ? 'PRESS A KEY' : gameBindingLabel(settings.controls[action])}
            />
          ))}
        </NativeUiSettingsGroup>
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
      <NativeUiSettingsGroup title="LIGHTING">
        <NativeUiSettingsToggle
          checked={settings.complexLighting}
          label="COMPLEX LIGHTING"
          onChange={(complexLighting) => onChange({ ...settings, complexLighting })}
        />
        <NativeUiSettingsToggle
          checked={settings.complexShadows}
          label="COMPLEX SHADOWS"
          onChange={(complexShadows) => onChange({ ...settings, complexShadows })}
        />
        <NativeUiSettingsToggle
          checked={settings.multipleShadows}
          label="MULTIPLE SHADOWS"
          onChange={(multipleShadows) => onChange({ ...settings, multipleShadows })}
        />
        <NativeUiSettingsRange
          label="LIGHT QUALITY"
          maximum={LIGHT_QUALITY_MAX_PERCENT}
          minimum={LIGHT_QUALITY_MIN_PERCENT}
          onChange={(lightQualityPercent) => onChange({ ...settings, lightQualityPercent })}
          value={settings.lightQualityPercent}
        />
      </NativeUiSettingsGroup>
      <NativeUiSettingsGroup title="PLAY STYLE">
        <NativeUiSettingsToggle
          checked={settings.castSecondariesAtMouse}
          label="CAST SECONDARY SPELLS AT MOUSE"
          onChange={(castSecondariesAtMouse) => onChange({
            ...settings,
            castSecondariesAtMouse,
          })}
        />
      </NativeUiSettingsGroup>
      <NativeUiSettingsGroup title="SPECIAL EFFECTS">
        <NativeUiSettingsToggle
          checked={settings.reducedScreenFlashes}
          label="REDUCED SCREEN FLASHES"
          onChange={(reducedScreenFlashes) => onChange({ ...settings, reducedScreenFlashes })}
        />
        <NativeUiSettingsToggle
          checked={settings.zoomEffects}
          label="CAMERA SHAKE"
          onChange={(zoomEffects) => onChange({ ...settings, zoomEffects })}
        />
        <NativeUiSettingsStaticRow
          detail="Fixed for synchronized multiplayer presentation."
          label="ENHANCED EFFECTS: ON"
        />
      </NativeUiSettingsGroup>
    </>
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
      {mode === 'install' ? (
        <NativeUiSettingsValueAction
          aria-expanded={showInstallHelp}
          data-settings-fullscreen
          label="FULLSCREEN"
          onClick={() => { void toggle() }}
          value="OPTIONS"
        />
      ) : (
        <NativeUiSettingsToggle
          checked={active}
          data-settings-fullscreen
          label="FULLSCREEN"
          onChange={() => { void toggle() }}
        />
      )}
      {showInstallHelp ? (
        <small role="status">Install this page as a web app for fullscreen on iPhone or iPad.</small>
      ) : null}
      {error ? <small role="alert">{error}</small> : null}
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
  if (page === 'cloud') return 'DARK CLOUD SETTINGS'
  if (page === 'controls') return 'CUSTOMIZE KEYBOARD'
  if (page === 'mobile-ui') return 'MOBILE UI EDITOR'
  if (page === 'performance') return 'TWEAK PERFORMANCE'
  if (page === 'save-transfer') return 'SAVE TRANSFER'
  return 'GAME SETTINGS'
}
