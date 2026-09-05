import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  inventoryItemsAtSackPath,
  reconcileInventorySackPath,
  type HubInventoryAction,
} from './core-kernels/hub-economy.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import type { PlayerBeltComponent } from './core-kernels/native-belt.ts'
import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'
import type { HubMemorialState } from './core-kernels/hub-memorial.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { nativeOptionalBookKeyAction } from './native-optional-book.ts'
import ContextualInteractButton from './ContextualInteractButton.tsx'
import {
  hubInteractionPromptLabel,
  hubInteractionWithinRange,
  hubNpcHintAcknowledgementAction,
  nearestHubInteraction,
  type HubInteractionId,
} from './hub-inventory-presentation.ts'
import { hubBoastFailureText } from './hub-npc-dialogue.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from './protocol/game-state.ts'
import type { GameModAsset, ModContentProjection } from './protocol/game-protocol.ts'
import type { NativeNoteboxKind, NativeNoteboxNotice } from './native-ui/core.ts'
import { NativeUiNotebox } from './native-ui/react.ts'
import {
  createHubInventoryRenderer,
  type HubInventoryRenderer,
} from './renderer/hub-inventory-renderer.ts'
import type {
  HubInventorySackTransitionModel,
} from './renderer/hub-inventory/model.ts'
import {
  createRetainedRendererOwner,
  type RetainedRendererOwner,
} from './renderer/retained-renderer-owner.ts'
import { HUB_SACK_PAGE_TRANSITION } from './renderer/hub-inventory-render-contract.ts'
import './hub-inventory.css'
import type { HubUiSurface } from './hub-inventory-ui-model.ts'
import { NativeHubSurface } from './HubInventorySurface.tsx'

function hubNativeSurfaceOwnerKey(surface: Exclude<HubUiSurface, null>): string {
  if (surface.kind === 'dialogue') return surface.interaction
  if (surface.kind === 'service') return surface.trader
  return surface.kind
}

interface HubInventoryUiProps {
  audio: GameAudioDirector
  belt: PlayerBeltComponent
  config: PlayerCharacterConfig
  disabled: boolean
  economy: ProtocolPlayerEconomy
  forceModalHudSettled: boolean
  inputSuspended: boolean
  inventoryEnabled?: boolean
  inventoryKeyCode: string
  menuKeyCode: string
  memorial?: HubMemorialState | null
  nativeUiStageStyle: CSSProperties
  onAction: (action: HubInventoryAction) => void
  onOpenSkills: () => void
  onUnassignBeltEntry?: (slot: number) => void
  modAssets: readonly GameModAsset[]
  modContent?: ModContentProjection | null
  onSurfaceChange: (surface: HubUiSurface) => void
  overlayRoot: RefObject<HTMLDivElement | null>
  playerPosition: Vector2
  progression: ProtocolPlayerProgression
  region: HubRegionId
  skillsKeyCode: string
  surface: HubUiSurface
  skorchaDismissalIndex?: number
  skorchaPosition?: Vector2 | null
  transitionActive: boolean
  interactionsEnabled?: boolean
  storyOffice?: boolean
}

export default function HubInventoryUi({
  audio,
  belt,
  config,
  disabled,
  economy,
  forceModalHudSettled,
  inputSuspended,
  inventoryEnabled = true,
  inventoryKeyCode,
  menuKeyCode,
  memorial = null,
  nativeUiStageStyle,
  onAction,
  onOpenSkills,
  onUnassignBeltEntry,
  modAssets,
  modContent = null,
  onSurfaceChange,
  overlayRoot,
  playerPosition,
  progression,
  region,
  skillsKeyCode,
  surface,
  skorchaDismissalIndex = 0,
  skorchaPosition = null,
  transitionActive,
  interactionsEnabled = true,
  storyOffice = false,
}: HubInventoryUiProps) {
  const rendererOwnerRef = useRef<RetainedRendererOwner<HubInventoryRenderer> | null>(null)
  rendererOwnerRef.current ??= createRetainedRendererOwner(
    () => createHubInventoryRenderer(modAssets),
  )
  const rendererOwner = rendererOwnerRef.current
  const failureSequenceRef = useRef(economy.npc.boast.failureSequence)
  const hagathaPurchasePendingRef = useRef(false)
  const noteboxSequenceRef = useRef(0)
  const [npcNotebox, setNpcNotebox] = useState<NativeNoteboxNotice | null>(null)
  const [inventorySackPath, setInventorySackPath] = useState<readonly number[]>([])
  const [inventorySackTransition, setInventorySackTransition] =
    useState<HubInventorySackTransitionModel | null>(null)
  const [inventoryCloseTarget, setInventoryCloseTarget] =
    useState<'closed' | 'skills' | null>(null)
  const showNotebox = useCallback((kind: NativeNoteboxKind, text: string) => {
    noteboxSequenceRef.current += 1
    setNpcNotebox({ kind, sequence: noteboxSequenceRef.current, text })
  }, [])
  const showInstructionNotebox = useCallback((text: string) => {
    showNotebox('instruction', text)
  }, [showNotebox])
  const serviceTrader = surface?.kind === 'service' ? surface.trader : null
  const nearestInteraction = useMemo(
    () => disabled || inputSuspended || transitionActive || !interactionsEnabled
      ? null
      : nearestHubInteraction(region, playerPosition, { skorchaPosition, storyOffice }),
    [
      disabled,
      inputSuspended,
      interactionsEnabled,
      playerPosition,
      region,
      skorchaPosition,
      storyOffice,
      transitionActive,
    ],
  )

  const closeSurface = useCallback(() => {
    if (surface?.kind === 'dialogue' && surface.source === 'college-intro') {
      onAction({ type: 'acknowledge-college-intro-dialogue' })
    }
    if (surface?.kind === 'service' && surface.trader === 'shlorio'
      && economy.dowsingOffers.length > 0) {
      onAction({ type: 'close-dowsing' })
    }
    if (surface?.kind === 'service' && surface.trader === 'hagatha'
      && hagathaPurchasePendingRef.current) {
      hagathaPurchasePendingRef.current = false
      onAction({ type: 'close-hagatha' })
    }
    setInventorySackPath([])
    setInventorySackTransition(null)
    setInventoryCloseTarget(null)
    onSurfaceChange(null)
  }, [economy.dowsingOffers.length, onAction, onSurfaceChange, surface])

  useEffect(() => () => rendererOwner.destroy(), [rendererOwner])

  useEffect(() => {
    if (serviceTrader === 'hagatha') hagathaPurchasePendingRef.current = false
  }, [serviceTrader])

  useEffect(() => {
    const feedback = economy.actionFeedback
    if (serviceTrader === 'hagatha'
      && feedback?.accepted === true && feedback.action === 'buy-hagatha') {
      hagathaPurchasePendingRef.current = true
    }
  }, [economy.actionFeedback, serviceTrader])

  const openInventorySack = useCallback((sackId: number) => {
    if (inventorySackTransition !== null) return
    const current = inventoryItemsAtSackPath(economy.backpack, inventorySackPath)
    const sack = current?.find((item) => (
      item.id === sackId
      && item.kind === 'sack'
      && item.nativeTypeId === 7008
    ))
    if (!sack) return
    const toPath = [...inventorySackPath, sack.id]
    const startedAtMs = performance.now()
    setInventorySackTransition({
      direction: 'open',
      fromPath: inventorySackPath,
      startedAtMs,
      toPath,
    })
    setInventorySackPath(toPath)
    audio.playSound('backpack-open')
  }, [audio, economy.backpack, inventorySackPath, inventorySackTransition])

  const returnFromInventorySack = useCallback((): boolean => {
    if (inventorySackTransition !== null) return true
    if (inventorySackPath.length === 0) return false
    const toPath = inventorySackPath.slice(0, -1)
    const startedAtMs = performance.now()
    setInventorySackTransition({
      direction: 'back',
      fromPath: inventorySackPath,
      startedAtMs,
      toPath,
    })
    setInventorySackPath(toPath)
    audio.playSound('backpack-close')
    return true
  }, [audio, inventorySackPath, inventorySackTransition])

  const beginInventoryClose = useCallback((target: 'closed' | 'skills') => {
    if (surface?.kind !== 'inventory' || inventoryCloseTarget !== null) return
    setInventoryCloseTarget(target)
    audio.playSound('open-panel')
    if (target === 'skills') onOpenSkills()
  }, [audio, inventoryCloseTarget, onOpenSkills, surface])

  const inventoryBackOrClose = useCallback(() => {
    if (returnFromInventorySack()) return
    if (surface?.kind === 'inventory') beginInventoryClose('closed')
    else {
      audio.playSound('open-panel')
      closeSurface()
    }
  }, [audio, beginInventoryClose, closeSurface, returnFromInventorySack, surface])

  useEffect(() => {
    const inventoryOwnerActive = surface?.kind === 'inventory' || surface?.kind === 'service'
    if (!inventoryOwnerActive) {
      if (inventorySackPath.length > 0) setInventorySackPath([])
      if (inventorySackTransition !== null) setInventorySackTransition(null)
      return
    }
    const reconciled = reconcileInventorySackPath(economy.backpack, inventorySackPath)
    if (reconciled.length !== inventorySackPath.length) {
      setInventorySackPath(reconciled)
      setInventorySackTransition(null)
    }
  }, [economy.backpack, inventorySackPath, inventorySackTransition, surface])

  useEffect(() => {
    if (inventorySackTransition === null) return
    const durationMs = HUB_SACK_PAGE_TRANSITION.ticks * HUB_SACK_PAGE_TRANSITION.nativeTickMs
    const timeout = window.setTimeout(() => {
      setInventorySackTransition((current) => (
        current?.startedAtMs === inventorySackTransition.startedAtMs ? null : current
      ))
    }, Math.max(0, inventorySackTransition.startedAtMs + durationMs - performance.now()))
    return () => window.clearTimeout(timeout)
  }, [inventorySackTransition])

  const openWorldDialogue = useCallback((interaction: HubInteractionId) => {
    const acknowledgement = hubNpcHintAcknowledgementAction(interaction, economy.npc.helpFlags)
    if (acknowledgement) onAction(acknowledgement)
    audio.playSound('click')
    onSurfaceChange({ interaction, kind: 'dialogue', source: 'world' })
  }, [audio, economy.npc.helpFlags, onAction, onSurfaceChange])

  useEffect(() => {
    if (!surface) return
    if (transitionActive || disabled) {
      closeSurface()
      return
    }
    if (surface.kind !== 'inventory' && surface.source === 'world' && !hubInteractionWithinRange(
      surface.kind === 'dialogue' ? surface.interaction : surface.trader,
      region,
      playerPosition,
      { skorchaPosition, storyOffice },
    )) closeSurface()
  }, [
    closeSurface,
    disabled,
    playerPosition,
    region,
    skorchaPosition,
    storyOffice,
    surface,
    transitionActive,
  ])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (inputSuspended) return
      if (event.repeat) return
      if (inventoryCloseTarget !== null) return
      if (surface?.kind === 'inventory') {
        const action = nativeOptionalBookKeyAction(event.code, 'inventory', {
          inventory: inventoryKeyCode,
          menu: menuKeyCode,
          skills: skillsKeyCode,
        })
        if (action !== null) {
          event.preventDefault()
          event.stopImmediatePropagation()
          if (action.type === 'replace') beginInventoryClose('skills')
          else inventoryBackOrClose()
          return
        }
      }
      if (surface && event.code === menuKeyCode) {
        if (surface.kind === 'dialogue' && event.code === menuKeyCode) return
        event.preventDefault()
        event.stopImmediatePropagation()
        if (surface.kind === 'inventory' || surface.kind === 'service') {
          inventoryBackOrClose()
        } else closeSurface()
        return
      }
      if (
        !surface
        && inventoryEnabled
        && !disabled
        && !transitionActive
        && event.code === inventoryKeyCode
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        onSurfaceChange({ kind: 'inventory' })
        return
      }
      if (surface || !nearestInteraction || (event.code !== 'KeyE' && event.key !== 'Enter')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      openWorldDialogue(nearestInteraction)
    }
    window.addEventListener('keydown', keyDown, { capture: true })
    return () => window.removeEventListener('keydown', keyDown, { capture: true })
  }, [
    beginInventoryClose,
    closeSurface,
    disabled,
    inventoryBackOrClose,
    inventoryEnabled,
    inventoryKeyCode,
    inventoryCloseTarget,
    inputSuspended,
    menuKeyCode,
    nearestInteraction,
    openWorldDialogue,
    onSurfaceChange,
    skillsKeyCode,
    surface,
    transitionActive,
  ])

  useEffect(() => {
    const sequence = economy.npc.boast.failureSequence
    if (sequence <= failureSequenceRef.current) return
    const text = hubBoastFailureText(economy.npc.boast, modContent)
    if (text === null) return
    failureSequenceRef.current = sequence
    audio.playStream('boast-failure')
    showNotebox('failure', text)
  }, [audio, economy.npc.boast, modContent, showNotebox])

  const prompt = !surface && nearestInteraction ? (
      <ContextualInteractButton
        label={hubInteractionPromptLabel(nearestInteraction)}
        target={`hub:${nearestInteraction}`}
        onInteract={() => openWorldDialogue(nearestInteraction)}
      />
    ) : null

  const overlay = surface ? (
    <NativeHubSurface
      key={hubNativeSurfaceOwnerKey(surface)}
      audio={audio}
      belt={belt}
      closing={inventoryCloseTarget !== null}
      config={config}
      economy={economy}
      forceModalHudSettled={forceModalHudSettled}
      inputSuspended={inputSuspended}
      menuKeyCode={menuKeyCode}
      memorial={memorial}
      modContent={modContent}
      onAction={onAction}
      onClose={closeSurface}
      onInventoryCloseComplete={() => {
        if (inventoryCloseTarget !== null) closeSurface()
      }}
      onInventoryBack={inventoryBackOrClose}
      onOpenSack={openInventorySack}
      onOpenSkills={() => beginInventoryClose('skills')}
      onNotebox={showInstructionNotebox}
      onSurfaceChange={onSurfaceChange}
      onUnassignBeltEntry={onUnassignBeltEntry}
      perkRemovalEnabled={interactionsEnabled}
      progression={progression}
      replacementTarget={inventoryCloseTarget}
      rendererOwner={rendererOwner}
      sackPath={inventorySackPath}
      sackTransition={inventorySackTransition}
      skorchaDismissalIndex={skorchaDismissalIndex}
      style={nativeUiStageStyle}
      surface={surface}
      storyOffice={storyOffice}
    />
  ) : null
  return (
    <>
      {prompt}
      {overlay && overlayRoot.current ? createPortal(overlay, overlayRoot.current) : null}
      {npcNotebox && overlayRoot.current ? createPortal(
        <NativeUiNotebox
          key={npcNotebox.sequence}
          notice={npcNotebox}
          onExpired={(sequence) => setNpcNotebox((current) => (
            current?.sequence === sequence ? null : current
          ))}
          style={nativeUiStageStyle}
        />,
        overlayRoot.current,
      ) : null}
    </>
  )
}
