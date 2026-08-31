import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { createPortal } from 'react-dom'

import {
  DOWSING_EQUIPMENT_RECIPES,
  HAGATHA_PERKS,
  MAX_NATIVE_DYE_SELECTIONS,
  NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
  findInventoryItem,
  inventoryItemsAtSackPath,
  inventoryItemsShareStack,
  nativeDyeMixedTint,
  inventoryDyeableClothingItems,
  nativeInventoryItemCanUnforge,
  nativeUnforgeOutcomeText,
  projectInventoryItems,
  projectInventoryRootSlots,
  reconcileInventorySackPath,
  type EquipmentSlot,
  type HubInventoryAction,
  type HubInventoryItem,
  type HubShopItem,
  type HubTraderId,
  type NativeUnforgeOutcome,
} from './core-kernels/hub-economy.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import {
  nativeInventoryItemCanBindToBelt,
  type PlayerBeltComponent,
} from './core-kernels/native-belt.ts'
import {
  NATIVE_SELECTOR_ACCEPT_TICKS,
} from './core-kernels/native-hub-npc.ts'
import type { ModBoastSelection } from './core-kernels/boast.ts'
import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'
import type { HubMemorialState } from './core-kernels/hub-memorial.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudModalSlideLayout,
  type NativeHudRect,
} from './native-hud-layout.ts'
import {
  initialNativeModalSlideProgressSnapshot,
  nativeModalSlideProgressSnapshot,
  setNativeModalSlideProgress,
  subscribeNativeModalSlideProgress,
} from './native-modal-slide-progress.ts'
import {
  nativeOptionalBookHudProgress,
  nativeOptionalBookKeyAction,
} from './native-optional-book.ts'
import ContextualInteractButton from './ContextualInteractButton.tsx'
import {
  HUB_INTERACTION_DIALOGUES,
  equipmentSlotsForItem,
  hubEquipmentClickAction,
  hubInteractionPromptLabel,
  hubInteractionDialogue,
  hubInteractionWithinRange,
  hubMemorialEulogyIndex,
  hubMemorialPortraitForInteraction,
  hubNpcHintAcknowledgementAction,
  nearestHubInteraction,
  type HubInteractionId,
} from './hub-inventory-presentation.ts'
import {
  createHubNpcChatContent,
  hubNpcChatChoices,
  hubNpcDismissal,
  hubNpcQuestion,
  hubNpcSelectorAction,
  hubBoastFailureText,
  hubBoastInstruction,
  hubNpcSelectorContent,
  hubNpcSelectorResponse,
  hubNpcSelectorRows,
  hubNpcSelectorRowKey,
  hubNpcSelectorTitle,
  type HubNpcChatChoice,
  type HubNpcChatContent,
  type HubNpcSelectorRow,
} from './hub-npc-dialogue.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from './protocol/game-state.ts'
import type { GameModAsset, ModContentProjection } from './protocol/game-protocol.ts'
import {
  nativeBeltPullOffStarted,
  nativeSkillQuickbarDropSlot,
} from './skill-book-model.ts'
import NativeBeltPullOffBurst from './NativeBeltPullOffBurst.tsx'
import {
  planNativeUiBoastMenu,
  type NativeNoteboxKind,
  type NativeNoteboxNotice,
} from './native-ui/core.ts'
import { NativeUiNotebox } from './native-ui/react.ts'
import {
  createHubInventoryRenderer,
  type HubInventoryDragModel,
  type HubInventoryDyeModalModel,
  type HubInventoryFlybyLaneModel,
  type HubInventoryFlybyModel,
  type HubInventoryPressedControl,
  type HubInventoryRenderer,
  type HubInventoryRendererModel,
  type HubInventoryRendererNotice,
  type HubInventorySackTransitionModel,
  type HubInventorySelectionModel,
  type HubServiceInspectionModel,
} from './renderer/hub-inventory-renderer.ts'
import {
  createRetainedRendererOwner,
  type RetainedRendererOwner,
} from './renderer/retained-renderer-owner.ts'
import {
  HUB_CHAT_PANEL,
  HUB_DOWSING_GRID,
  HUB_DYE_CLOTHING,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_HAT_REMOVAL_MSGBOX,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_FLYBY,
  HUB_INVENTORY_PARENT_HOLDER,
  HUB_INVENTORY_INTERACTION,
  HUB_INVENTORY_STATS_PAGES,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_TIMING,
  HUB_NPC_SELECTOR,
  HUB_ROBE_REMOVAL_MSGBOX,
  HUB_SACK_PAGE_TRANSITION,
  HUB_UNFORGE_CONFIRMATION,
  HUB_UNFORGE_RESULT,
  HUB_UNFORGE_TARGET,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  hubNpcSelectorClampScroll,
  hubNpcSelectorDragScroll,
  hubNpcSelectorVisibleRows,
  hubNpcSelectorWheelScroll,
  hubNativeUiCloseReveal,
  hubNativeUiReveal,
  hubDowsingSlotPosition,
  hubDyeItemLayerRects,
  hubDyeSwatchRect,
  hubHagathaFullMindNotice,
  hubHagathaTooltipLines,
  hubInventoryEquipmentSlotRects,
  hubInventoryRootSlot,
  hubInventoryStatsArrowRect,
  hubItemTooltipLines,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
  hubOwnedPerkSlotRect,
  hubShopSlotPosition,
} from './renderer/hub-inventory-render-contract.ts'
import './hub-inventory.css'

const EQUIPMENT_SLOT_LABELS: Readonly<Record<EquipmentSlot, string>> = {
  amulet: 'Amulet',
  hat: 'Hat',
  'ring-0': 'Ring I',
  'ring-1': 'Ring II',
  'ring-2': 'Ring III',
  robe: 'Robe',
  weapon: 'Weapon',
}
const EQUIPMENT_SLOT_ORDER: readonly EquipmentSlot[] = [
  'hat',
  'robe',
  'amulet',
  'weapon',
  'ring-0',
  'ring-1',
  'ring-2',
]

interface HubServiceSelection {
  readonly id: number
  readonly owner: 'storage' | null
}

type InventoryMoveAction = Extract<HubInventoryAction, { readonly type: 'move-inventory-item' }>

interface InventoryFlybyRequest {
  readonly action: InventoryMoveAction | null
  readonly lanes: readonly HubInventoryFlybyLaneModel[]
}

interface InventoryFlybyState extends HubInventoryFlybyModel {
  readonly action: InventoryMoveAction | null
  readonly actionDispatched: boolean
  readonly feedbackSequence: number
}

interface HubInventoryUiNotice extends HubInventoryRendererNotice {
  readonly unforgeItemId?: number
}

interface HubNpcChatPresentation {
  readonly acceleratedAtMs: number | null
  readonly content: HubNpcChatContent
  readonly phaseStartedAtMs: number
  readonly selectorOffset: number
  readonly selectorScroll: number
}

interface PendingHubNpcSelection {
  readonly action: 'buy-teacher-spell' | 'read-librarian-book' | 'select-boast'
  readonly id: number | ModBoastSelection
  readonly selector: 'boast' | 'books' | 'teacher-spells'
}

const HUB_UNFORGE_CONFIRMATION_NOTICE: HubInventoryRendererNotice = {
  actionLabel: 'UNFORGE',
  body: 'Unforging grants you a permanent small bonus to your stats, but utterly destroys the item.',
  secondaryActionLabel: 'CANCEL',
  title: 'REALLY UNFORGE THIS?',
  variant: 'unforge-confirmation',
}

function unforgeResultNotice(outcome: NativeUnforgeOutcome): HubInventoryUiNotice {
  const failed = outcome.kind === 'fizzle'
  return {
    actionLabel: 'OKAY',
    body: nativeUnforgeOutcomeText(outcome),
    outcomeTint: failed ? 0xff4040 : 0x40ff40,
    summary: failed ? 'Spellbreaking fizzles!' : 'Unforging bonus:',
    title: failed ? 'FAILED UNFORGING!' : `${outcome.itemName.toUpperCase()} UNFORGED`,
    variant: 'unforge-result',
  }
}

export type HubUiSurface =
  | {
      readonly interaction: HubInteractionId
      readonly kind: 'dialogue'
      readonly source: 'college-intro' | 'shortcut' | 'world'
    }
  | { readonly kind: 'inventory' }
  | {
      readonly kind: 'service'
      readonly source: 'shortcut' | 'world'
      readonly trader: HubTraderId
    }
  | null

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

function NativeHubSurface({
  audio,
  belt,
  closing,
  config,
  economy,
  forceModalHudSettled,
  inputSuspended,
  menuKeyCode,
  memorial,
  modContent,
  onAction,
  onClose,
  onInventoryCloseComplete,
  onInventoryBack,
  onNotebox,
  onOpenSack,
  onOpenSkills,
  onSurfaceChange,
  onUnassignBeltEntry,
  perkRemovalEnabled,
  progression,
  replacementTarget,
  rendererOwner,
  sackPath,
  sackTransition,
  skorchaDismissalIndex,
  style,
  surface,
  storyOffice,
}: {
  audio: GameAudioDirector
  belt: PlayerBeltComponent
  closing: boolean
  config: PlayerCharacterConfig
  economy: ProtocolPlayerEconomy
  forceModalHudSettled: boolean
  inputSuspended: boolean
  menuKeyCode: string
  memorial: HubMemorialState | null
  modContent: ModContentProjection | null
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onInventoryCloseComplete: () => void
  onInventoryBack: () => void
  onNotebox: (text: string) => void
  onOpenSack: (sackId: number) => void
  onOpenSkills: () => void
  onSurfaceChange: (surface: HubUiSurface) => void
  onUnassignBeltEntry?: (slot: number) => void
  perkRemovalEnabled: boolean
  progression: ProtocolPlayerProgression
  replacementTarget: 'closed' | 'skills' | null
  rendererOwner: RetainedRendererOwner<HubInventoryRenderer>
  sackPath: readonly number[]
  sackTransition: HubInventorySackTransitionModel | null
  skorchaDismissalIndex: number
  style: CSSProperties
  surface: Exclude<HubUiSurface, null>
  storyOffice: boolean
}) {
  const collegeIntroAcknowledgedRef = useRef(false)
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<HubInventoryRenderer | null>(null)
  const modelRef = useRef<HubInventoryRendererModel | null>(null)
  const revealStartedAtRef = useRef<number | null>(null)
  const closeStartedAtRef = useRef<number | null>(null)
  const closeStartRevealRef = useRef(0)
  const closeCompletedRef = useRef(false)
  const closingRef = useRef(closing)
  const forceModalHudSettledRef = useRef(forceModalHudSettled)
  const onInventoryCloseCompleteRef = useRef(onInventoryCloseComplete)
  const chatCompletionHandledRef = useRef(false)
  const advanceChatRef = useRef<() => void>(() => undefined)
  const chatRandomIndexRef = useRef(
    surface.kind === 'dialogue' && surface.interaction === 'skorcha'
      ? skorchaDismissalIndex - 1
      : economy.revision + economy.npc.boast.failureSequence,
  )
  const selectorResponseTimeoutRef = useRef<number | null>(null)
  const [rendererState, setRendererState] = useState<'error' | 'loading' | 'ready'>('loading')
  const [notice, setNotice] = useState<HubInventoryUiNotice | null>(null)
  const [highlightedNpcSelectorId, setHighlightedNpcSelectorId] =
    useState<number | ModBoastSelection | null>(null)
  const [pressedControl, setPressedControl] = useState<HubInventoryPressedControl>(null)
  const [chat, setChat] = useState<HubNpcChatPresentation>(() => ({
    acceleratedAtMs: null,
    content: surface.kind === 'dialogue'
      ? createHubNpcChatContent(
          surface.interaction,
          economy.npc,
          chatRandomIndexRef.current,
          memorial === null
            ? null
            : hubMemorialEulogyIndex(surface.interaction, memorial),
          storyOffice,
          memorial === null
            ? null
            : hubMemorialPortraitForInteraction(surface.interaction, memorial),
        )
      : { kind: 'choices' },
    phaseStartedAtMs: performance.now(),
    selectorOffset: 0,
    selectorScroll: 0,
  }))
  const [pendingNpcSelection, setPendingNpcSelection] =
    useState<PendingHubNpcSelection | null>(null)
  const [serviceSelection, setServiceSelection] = useState<HubServiceSelection | null>(null)
  const [serviceHoverInspection, setServiceHoverInspection] = useState<HubServiceInspectionModel | null>(null)
  const [serviceFocusInspection, setServiceFocusInspection] = useState<HubServiceInspectionModel | null>(null)
  const [inventorySelection, setInventorySelection] = useState<HubInventorySelectionModel | null>(null)
  const [inventoryDrag, setInventoryDrag] = useState<HubInventoryDragModel | null>(null)
  const [inventoryFlybys, setInventoryFlybys] = useState<readonly InventoryFlybyState[]>([])
  const [statsPage, setStatsPage] = useState(0)
  const [dyeModal, setDyeModal] = useState<HubInventoryDyeModalModel | null>(null)
  const feedbackSequenceRef = useRef(economy.actionFeedback?.sequence ?? 0)
  closingRef.current = closing
  forceModalHudSettledRef.current = forceModalHudSettled
  onInventoryCloseCompleteRef.current = onInventoryCloseComplete
  const modalSlides = useSyncExternalStore(
    subscribeNativeModalSlideProgress,
    nativeModalSlideProgressSnapshot,
    initialNativeModalSlideProgressSnapshot,
  )
  const inventoryIntrinsicProgress = surface.kind === 'inventory' ? modalSlides.inventory : 1
  const inventoryHudProgress = nativeOptionalBookHudProgress(
    inventoryIntrinsicProgress,
    forceModalHudSettled,
  )
  const inventoryModalHud = nativeHudModalSlideLayout(
    NATIVE_HUD_BACKBUFFER.width,
    NATIVE_HUD_BACKBUFFER.height,
    inventoryHudProgress,
  )
  const inventoryResumeControl = inventoryModalHud.backpack
  const inventoryResumeRect = [
    inventoryResumeControl.x,
    inventoryResumeControl.y,
    inventoryResumeControl.width,
    inventoryResumeControl.height,
  ] as const
  const inventorySkillsControl = inventoryModalHud.tome
  const inventorySkillsRect = [
    inventorySkillsControl.x,
    inventorySkillsControl.y,
    inventorySkillsControl.width,
    inventorySkillsControl.height,
  ] as const
  const inventoryBeltRects = inventoryModalHud.belt

  const inventoryFlyby = inventoryFlybys.find(({ phase }) => phase === 'flying') ?? null

  const startInventoryFlyby = useCallback((request: InventoryFlybyRequest) => {
    setInventoryFlybys((current) => current.some(({ phase }) => phase === 'flying')
      ? current
      : [...current, {
          ...request,
          actionDispatched: false,
          feedbackSequence: economy.actionFeedback?.sequence ?? 0,
          phase: 'flying',
          startedAtMs: performance.now(),
        }])
  }, [economy.actionFeedback?.sequence])

  useEffect(() => {
    if (!inventoryFlyby || inventoryFlyby.phase !== 'flying'
      || inventoryFlyby.actionDispatched) return
    const travelMs = HUB_INVENTORY_FLYBY.travelTicks * HUB_INVENTORY_FLYBY.tickMs
    const timeout = window.setTimeout(() => {
      if (inventoryFlyby.action) onAction(inventoryFlyby.action)
      setInventoryFlybys((current) => current.map((entry) => (
        entry.startedAtMs === inventoryFlyby.startedAtMs
          ? {
              ...entry,
              actionDispatched: true,
              phase: entry.action === null ? 'trailing' : 'flying',
            }
          : entry
      )))
    }, Math.max(0, inventoryFlyby.startedAtMs + travelMs - performance.now()))
    return () => window.clearTimeout(timeout)
  }, [inventoryFlyby, onAction])

  useEffect(() => {
    if (!inventoryFlyby?.action || !inventoryFlyby.actionDispatched) return
    const feedback = economy.actionFeedback
    if (!feedback || feedback.sequence <= inventoryFlyby.feedbackSequence
      || feedback.action !== inventoryFlyby.action.type) return
    setInventoryFlybys((current) => current.map((entry) => (
      entry.startedAtMs === inventoryFlyby.startedAtMs
        ? { ...entry, phase: 'trailing' }
        : entry
    )))
  }, [economy.actionFeedback, inventoryFlyby])

  useEffect(() => {
    const finalTick = HUB_INVENTORY_FLYBY.travelTicks - 1 + HUB_INVENTORY_FLYBY.tailTicks
    const trailing = inventoryFlybys.filter(({ phase }) => phase === 'trailing')
    if (trailing.length === 0) return
    const nextExpiry = Math.min(...trailing.map(({ startedAtMs }) => (
      startedAtMs + finalTick * HUB_INVENTORY_FLYBY.tickMs
    )))
    const timeout = window.setTimeout(() => {
      const nowMs = performance.now()
      setInventoryFlybys((current) => current.filter((entry) => (
        entry.phase !== 'trailing'
          || entry.startedAtMs + finalTick * HUB_INVENTORY_FLYBY.tickMs > nowMs
      )))
    }, Math.max(0, nextExpiry - performance.now()))
    return () => window.clearTimeout(timeout)
  }, [inventoryFlybys])

  useLayoutEffect(() => {
    if (surface.kind !== 'inventory') return
    closeStartedAtRef.current = null
    closeStartRevealRef.current = 0
    closeCompletedRef.current = false
    setNativeModalSlideProgress('inventory', 0)
  }, [surface.kind])

  useEffect(() => {
    if (chat.content.kind !== 'speech' || chat.content.key !== 'ARCH_INTRO_0') return
    audio.playStream('arch-intro-0')
    return () => audio.stopStream('arch-intro-0')
  }, [audio, chat.content])

  useEffect(() => {
    const feedback = economy.actionFeedback
    if (!feedback || feedback.sequence <= feedbackSequenceRef.current) return
    feedbackSequenceRef.current = feedback.sequence
    if (pendingNpcSelection && feedback.action === pendingNpcSelection.action) {
      if (!feedback.accepted) {
        audio.playSound('bad-action')
        setPendingNpcSelection(null)
        return
      }
      audio.playSound(pendingNpcSelection.action === 'buy-teacher-spell'
        ? 'drop-coins'
        : 'pick-skill')
      const response = hubNpcSelectorResponse(
        pendingNpcSelection.selector,
        pendingNpcSelection.id,
        modContent,
      )
      if (!response) setPendingNpcSelection(null)
      else selectorResponseTimeoutRef.current = window.setTimeout(() => {
        selectorResponseTimeoutRef.current = null
        setPendingNpcSelection(null)
        chatCompletionHandledRef.current = false
        setChat({
          acceleratedAtMs: null,
          content: response,
          phaseStartedAtMs: performance.now(),
          selectorOffset: 0,
          selectorScroll: 0,
        })
      }, NATIVE_SELECTOR_ACCEPT_TICKS * 10)
      return
    }
    if (feedback.action === 'dye') {
      if (!feedback.accepted) {
        audio.playSound('bad-action')
        setDyeModal((current) => current ? { ...current, pending: false } : current)
        return
      }
      audio.playStream('dye')
      setDyeModal((current) => current ? {
        ...current,
        closingAtMs: performance.now(),
        pending: false,
      } : current)
      return
    }
    if (feedback.action === 'unforge') {
      if (!feedback.accepted || !feedback.unforgeOutcome) {
        audio.playSound('bad-action')
        return
      }
      audio.playSound(feedback.unforgeOutcome.kind === 'fizzle' ? 'fizzle' : 'unforge')
      setNotice(unforgeResultNotice(feedback.unforgeOutcome))
      return
    }
    if (!feedback.accepted && feedback.action === 'buy-hagatha'
      && feedback.reason === 'perk-capacity-full') {
      audio.playSound('bad-action')
      setNotice(hubHagathaFullMindNotice(serviceSelection?.id ?? -1))
      return
    }
    if (!feedback.accepted) {
      audio.playSound('bad-action')
      return
    }
    if (feedback.action === 'buy-hagatha') {
      audio.playSound('drop-coins')
      return
    }
    if (feedback.action === 'buy-fomentius') {
      audio.playSound('drop-coins')
      return
    }
    if (feedback.action === 'buy-dowsing') {
      audio.playSound('drop-coins')
      if (feedback.dowsingPitch !== null) {
        audio.playSound('distort-reality', { playbackRate: feedback.dowsingPitch })
      }
      return
    }
    if (feedback.action === 'dowse') {
      audio.playSound('pick-skill')
      window.setTimeout(() => audio.playSound('pick-skill', { volume: 0.25 }), 250)
      window.setTimeout(() => audio.playSound('pick-skill', { volume: 0.0625 }), 500)
      window.setTimeout(() => audio.playSound('pick-skill', { volume: 0.015625 }), 750)
      if (feedback.dowsingPitch !== null) {
        audio.playSound('distort-reality', { playbackRate: feedback.dowsingPitch })
      }
      return
    }
    if (feedback.action === 'consume') {
      audio.playSound('drink')
      return
    }
    if (feedback.action === 'read-skill-book') {
      if (feedback.accepted) onClose()
      return
    }
    if (feedback.action === 'transfer') {
      if (feedback.transferGesture === 'double-activation') audio.playSound('backpack-close')
      else audio.playSound('click', { playbackRate: 0.75 })
    }
  }, [audio, economy.actionFeedback, modContent, onClose, pendingNpcSelection, serviceSelection?.id])

  useEffect(() => () => {
    if (selectorResponseTimeoutRef.current !== null) {
      window.clearTimeout(selectorResponseTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (dyeModal?.closingAtMs === null || dyeModal === null) return
    const timeout = window.setTimeout(() => setDyeModal(null), 120)
    return () => window.clearTimeout(timeout)
  }, [dyeModal])

  useEffect(() => {
    setInventorySelection(null)
    setInventoryDrag(null)
    setInventoryFlybys([])
  }, [sackPath])

  useEffect(() => {
    if (!dyeModal || dyeModal.pending || dyeModal.closingAtMs !== null) return
    const dye = findInventoryItem(economy.backpack, dyeModal.dyeItemId)
    if (!dye || dye.kind !== 'dye' || dye.nativeTypeId !== 7012 || dye.nativeSubtype !== 0) {
      setDyeModal(null)
      return
    }
    if (dyeModal.targetItemId !== null
      && !inventoryDyeableClothingItems(economy.backpack).some(
        ({ item }) => item.id === dyeModal.targetItemId,
      )) {
      setDyeModal((current) => current ? { ...current, targetItemId: null } : current)
    }
  }, [dyeModal, economy.backpack])

  useEffect(() => {
    const selectedAtMs = dyeModal?.selectedAtMs
    if (selectedAtMs === null || selectedAtMs === undefined) return
    const pulseDurationMs = HUB_DYE_CLOTHING.selectedPulseTicks
      * HUB_DYE_CLOTHING.nativeTickMs
    const timeout = window.setTimeout(() => setDyeModal((current) => (
      current?.selectedAtMs === selectedAtMs
        ? { ...current, selectedAtMs: null, selectedRow: null }
        : current
    )), Math.max(0, selectedAtMs + pulseDurationMs - performance.now()))
    return () => window.clearTimeout(timeout)
  }, [dyeModal?.selectedAtMs])

  const beginChatContent = useCallback((content: HubNpcChatContent) => {
    chatCompletionHandledRef.current = false
    setHighlightedNpcSelectorId(null)
    setChat({
      acceleratedAtMs: null,
      content,
      phaseStartedAtMs: performance.now(),
      selectorOffset: 0,
      selectorScroll: 0,
    })
  }, [])

  const selectorRows = useMemo((): readonly HubNpcSelectorRow[] => (
    chat.content.kind === 'selector'
      ? hubNpcSelectorRows(chat.content.selector, economy.npc, progression, modContent)
      : []
  ), [chat.content, economy.npc, modContent, progression])

  const advanceChat = useCallback(() => {
    if (surface.kind !== 'dialogue' || chat.content.kind !== 'speech') return
    if (chat.content.next === 'choices') {
      beginChatContent({ kind: 'choices' })
      return
    }
    if (chat.content.next === 'dismissal') {
      chatRandomIndexRef.current += 1
      const dismissal = hubNpcDismissal(
        surface.interaction,
        chatRandomIndexRef.current,
        storyOffice,
      )
      if (dismissal) beginChatContent(dismissal)
      else onClose()
      return
    }
    if (
      (chat.content.key.startsWith('ANNAL_') || chat.content.key.startsWith('MOD_BOAST_'))
      && economy.npc.boast.selected !== null
    ) {
      const instruction = hubBoastInstruction(economy.npc.boast.selected, modContent)
      if (instruction !== null) onNotebox(instruction)
    }
    onClose()
  }, [
    beginChatContent,
    chat.content,
    economy.npc.boast.selected,
    modContent,
    onClose,
    onNotebox,
    storyOffice,
    surface,
  ])
  advanceChatRef.current = advanceChat

  const dismissOrCloseChat = useCallback(() => {
    if (surface.kind !== 'dialogue') return
    const dismissal = hubNpcDismissal(
      surface.interaction,
      ++chatRandomIndexRef.current,
      storyOffice,
    )
    if (dismissal) beginChatContent(dismissal)
    else onClose()
  }, [beginChatContent, onClose, storyOffice, surface])

  useEffect(() => {
    if (surface.kind !== 'dialogue') return
    const back = (event: KeyboardEvent) => {
      if (inputSuspended) return
      if (event.repeat || event.code !== menuKeyCode) return
      event.preventDefault()
      event.stopImmediatePropagation()
      audio.playSound('click')
      if (chat.content.kind === 'selector') {
        beginChatContent({ kind: 'choices' })
      } else if (chat.content.kind === 'speech' && chat.content.next === 'close') {
        advanceChatRef.current()
      } else {
        dismissOrCloseChat()
      }
    }
    window.addEventListener('keydown', back, { capture: true })
    return () => window.removeEventListener('keydown', back, { capture: true })
  }, [audio, beginChatContent, chat.content, dismissOrCloseChat, inputSuspended, menuKeyCode, surface.kind])

  const model = useMemo((): HubInventoryRendererModel => {
    if (surface.kind === 'inventory') return {
      belt,
      config,
      dragging: inventoryDrag,
      dyeModal,
      economy,
      flybys: inventoryFlybys,
      inspection: serviceHoverInspection ?? serviceFocusInspection,
      kind: 'inventory',
      notice,
      pressedControl,
      progression,
      sackPath,
      sackTransition,
      selection: inventorySelection,
      statsPage,
    }
    if (surface.kind === 'dialogue') return {
      acceleratedAtMs: chat.acceleratedAtMs,
      content: chat.content,
      gold: economy.gold,
      interaction: surface.interaction,
      kind: 'dialogue',
      phaseStartedAtMs: chat.phaseStartedAtMs,
      highlightedSelectorId: highlightedNpcSelectorId,
      selectedSelectorId: pendingNpcSelection?.id ?? null,
      selectorOffset: chat.selectorOffset,
      selectorScroll: chat.selectorScroll,
      selectorRows,
      storyOffice,
    }
    return {
      belt,
      config,
      dragging: inventoryDrag,
      dyeModal,
      economy,
      flybys: inventoryFlybys,
      inspection: serviceHoverInspection ?? serviceFocusInspection,
      inventorySelection,
      kind: 'service',
      notice,
      pressedControl,
      progression,
      sackPath,
      sackTransition,
      selectedItemId: serviceSelection?.id ?? null,
      selectedOwner: serviceSelection?.owner ?? null,
      statsPage,
      trader: surface.trader,
    }
  }, [
    belt,
    chat,
    config,
    economy,
    dyeModal,
    inventoryDrag,
    inventoryFlybys,
    inventorySelection,
    highlightedNpcSelectorId,
    notice,
    pendingNpcSelection,
    pressedControl,
    progression,
    sackPath,
    sackTransition,
    serviceFocusInspection,
    serviceHoverInspection,
    serviceSelection,
    statsPage,
    selectorRows,
    storyOffice,
    surface,
  ])

  useLayoutEffect(() => {
    revealStartedAtRef.current = null
  }, [surface.kind])

  useLayoutEffect(() => {
    modelRef.current = model
    rendererRef.current?.setModel(model)
  }, [model])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let renderer: HubInventoryRenderer | undefined
    void rendererOwner.get().then((created) => {
      if (disposed) return
      renderer = created
      rendererRef.current = created
      created.setModel(modelRef.current!)
      host.replaceChildren(created.canvas)
      revealStartedAtRef.current = null
      setRendererState('ready')
    }).catch(() => {
      if (!disposed) setRendererState('error')
    })
    const unsubscribe = subscribeGamePresentationFrames((nowMs) => {
      if (!renderer) return
      revealStartedAtRef.current ??= nowMs
      const currentKind = modelRef.current?.kind
      if (!currentKind) return
      const step = currentKind === 'dialogue'
        ? HUB_NATIVE_UI_TIMING.chatRevealPerTick
        : HUB_NATIVE_UI_TIMING.inventoryRevealPerTick
      const openingReveal = hubNativeUiReveal(nowMs - revealStartedAtRef.current, step)
      let reveal = openingReveal
      if (currentKind === 'inventory' && closingRef.current) {
        if (closeStartedAtRef.current === null) {
          closeStartedAtRef.current = nowMs
          closeStartRevealRef.current = openingReveal
        }
        reveal = hubNativeUiCloseReveal(
          closeStartRevealRef.current,
          nowMs - closeStartedAtRef.current,
          step,
        )
      }
      if (currentKind === 'inventory') setNativeModalSlideProgress('inventory', reveal)
      const frame = renderer.render(
        nowMs,
        reveal,
        currentKind === 'inventory'
          ? nativeOptionalBookHudProgress(reveal, forceModalHudSettledRef.current)
          : reveal,
      )
      if (
        currentKind === 'inventory'
        && closingRef.current
        && reveal === 0
        && !closeCompletedRef.current
      ) {
        closeCompletedRef.current = true
        onInventoryCloseCompleteRef.current()
      }
      const current = modelRef.current
      if (frame.chatComplete && current?.kind === 'dialogue'
        && current.content.kind === 'speech' && !chatCompletionHandledRef.current) {
        chatCompletionHandledRef.current = true
        advanceChatRef.current()
      }
    })
    return () => {
      disposed = true
      unsubscribe()
      rendererRef.current = null
      host.replaceChildren()
    }
  }, [rendererOwner])

  useEffect(() => {
    if (surface.kind !== 'dialogue' && inventorySelection) {
      if (inventorySelection.owner === 'backpack') {
        const item = findInventoryItem(economy.backpack, inventorySelection.id)
        if (!item) {
          const equippedSlot = EQUIPMENT_SLOT_ORDER.find(
            (slot) => itemAtEquipmentSlot(economy, slot)?.id === inventorySelection.id,
          )
          if (equippedSlot) {
            setInventorySelection({
              equipmentSlot: equippedSlot,
              id: inventorySelection.id,
              owner: 'equipment',
              startedAtMs: performance.now() - HUB_INVENTORY_INTERACTION.itemInfoDelayMs,
            })
          } else setInventorySelection(null)
        } else if (!inventoryItemsAtSackPath(economy.backpack, sackPath)
          ?.some(({ id }) => id === inventorySelection.id)) setInventorySelection(null)
      } else {
        const equipped = inventorySelection.equipmentSlot === null
          ? null
          : itemAtEquipmentSlot(economy, inventorySelection.equipmentSlot)
        if (equipped?.id !== inventorySelection.id) {
          if (inventoryItemsAtSackPath(economy.backpack, sackPath)
            ?.some(({ id }) => id === inventorySelection.id)) {
            setInventorySelection({
              equipmentSlot: null,
              id: inventorySelection.id,
              owner: 'backpack',
              startedAtMs: performance.now() - HUB_INVENTORY_INTERACTION.itemInfoDelayMs,
            })
          } else setInventorySelection(null)
        }
      }
    }
    if (surface.kind !== 'service') return
    if (!serviceSelection) return
    const present = surface.trader === 'luthacus'
      ? serviceSelection.owner === 'storage'
        && findInventoryItem(economy.storage, serviceSelection.id) !== null
      : surface.trader === 'fomentius'
        ? economy.fomentiusStock.some(({ id }) => id === serviceSelection.id)
        : surface.trader === 'hagatha'
          ? economy.hagathaOffers.some(({ selector }) => selector === serviceSelection.id)
          : economy.dowsingOffers.some(({ id }) => id === serviceSelection.id)
    if (!present) setServiceSelection(null)
  }, [economy, inventorySelection, sackPath, serviceSelection, surface])

  const click = (action: () => void) => {
    audio.playSound('click')
    action()
  }
  const openDye = (dyeItemId: number) => {
    audio.playSound('click')
    setNotice(null)
    setInventoryDrag(null)
    setDyeModal({
      closingAtMs: null,
      dyeItemId,
      openedAtMs: performance.now(),
      path: sackPath,
      pending: false,
      selectedAtMs: null,
      selectedRow: null,
      swatchRows: [],
      targetItemId: null,
    })
  }
  const cancelDye = () => setDyeModal((current) => {
    if (!current || current.closingAtMs !== null || current.pending) return current
    return current.targetItemId === null
      ? { ...current, closingAtMs: performance.now() }
      : { ...current, targetItemId: null }
  })

  const label = surface.kind === 'inventory'
    ? 'Inventory'
    : surface.kind === 'dialogue'
      ? `Talking to ${hubInteractionDialogue(surface.interaction, storyOffice).name}`
      : HUB_INTERACTION_DIALOGUES[surface.trader].title
  const activeServiceInspection = serviceHoverInspection ?? serviceFocusInspection
  const semanticTooltip = surface.kind !== 'dialogue' && activeServiceInspection
    ? serviceInspectionTooltipText(
        activeServiceInspection,
        economy,
        progression,
        surface.kind === 'service' ? surface.trader : 'hagatha',
      )
    : null

  return (
    <div
      className="hub-native-ui-overlay"
      data-input-suspended={inputSuspended}
      data-replacement-target={replacementTarget ?? ''}
      data-surface-kind={surface.kind}
      inert={inputSuspended || closing || undefined}
    >
      <section
        className="hub-native-ui-stage"
        style={style}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-renderer-state={rendererState}
        data-native-pressed-control={pressedControl ?? 'none'}
        data-native-chat-phase={surface.kind === 'dialogue' ? chat.content.kind : ''}
        data-native-chat-record={surface.kind === 'dialogue' && chat.content.kind === 'speech'
          ? chat.content.key
          : ''}
        data-native-notice={notice?.title ?? ''}
        data-native-inventory-selection={inventorySelection
          ? `${inventorySelection.owner}:${inventorySelection.equipmentSlot ?? inventorySelection.id}`
          : ''}
        data-native-inventory-dragging={inventoryDrag
          ? `${inventoryDrag.owner}:${inventoryDrag.equipmentSlot ?? inventoryDrag.itemId}`
          : ''}
        data-native-sack-path={sackPath.join('/')}
        data-native-sack-transition={sackTransition?.direction ?? ''}
        data-native-stats-page={statsPage}
        data-native-dye-modal={dyeModal
          ? `${dyeModal.targetItemId === null ? 'mix' : 'layer'}:${dyeModal.closingAtMs === null ? 'open' : 'closing'}`
          : ''}
        data-native-dye-selections={dyeModal?.swatchRows.join(',') ?? ''}
        data-native-dye-tub={dyeModal
          ? (nativeDyeMixedTint(dyeModal.swatchRows)?.toString(16).padStart(6, '0') ?? '')
          : ''}
        data-native-tooltip={semanticTooltip ?? ''}
      >
        <div ref={hostRef} className="hub-native-ui-renderer" aria-hidden />
        <div className="hub-native-ui-actions">
          <span className="hub-native-ui-semantic hub-gold-ledger" data-player-gold={economy.gold}>
            {economy.gold.toLocaleString()} gold
          </span>
          {dyeModal ? (
            <DyeClothingActions
              economy={economy}
              modal={dyeModal}
              onCancel={cancelDye}
              onCommit={(layer) => {
                if (dyeModal.pending || dyeModal.targetItemId === null) return
                setDyeModal((current) => current ? { ...current, pending: true } : current)
                onAction({
                  type: 'dye',
                  dyeItemId: dyeModal.dyeItemId,
                  layer,
                  swatchRows: dyeModal.swatchRows,
                  targetItemId: dyeModal.targetItemId,
                })
              }}
              onSelectSwatch={(row) => {
                if (dyeModal.pending || dyeModal.targetItemId !== null
                  || dyeModal.swatchRows.length >= MAX_NATIVE_DYE_SELECTIONS) return
                audio.playSound('click')
                setDyeModal((current) => current ? {
                  ...current,
                  selectedAtMs: performance.now(),
                  selectedRow: row,
                  swatchRows: [...current.swatchRows, row],
                } : current)
              }}
              onSelectTarget={(targetItemId) => {
                if (dyeModal.pending || dyeModal.swatchRows.length === 0) return
                audio.playSound('click')
                setDyeModal((current) => current ? { ...current, targetItemId } : current)
              }}
            />
          ) : notice ? (
            <>
              <span className="hub-native-ui-semantic" role="alert">
                {notice.title} {notice.summary ? `${notice.summary} ` : ''}{notice.body}
              </span>
              <NativeAction
                label={notice.actionLabel}
                rect={notice.variant === 'unforge-confirmation'
                  ? HUB_UNFORGE_CONFIRMATION.primaryButtonRect
                  : notice.variant === 'unforge-result'
                    ? HUB_UNFORGE_RESULT.primaryButtonRect
                    : HUB_DOWSING_MSGBOX.primaryButtonActionRect}
                onClick={() => {
                  setPressedControl(null)
                  click(() => {
                    if (notice.variant === 'unforge-confirmation'
                      && notice.unforgeItemId !== undefined) {
                      onAction({ type: 'unforge', itemId: notice.unforgeItemId })
                    }
                    setNotice(null)
                  })
                }}
                onPressedChange={(pressed) => setPressedControl(
                  pressed ? 'message-primary' : null,
                )}
              />
              {notice.variant === 'unforge-confirmation' ? (
                <NativeAction
                  gameBack
                  label={notice.secondaryActionLabel ?? 'CANCEL'}
                  rect={HUB_UNFORGE_CONFIRMATION.secondaryButtonRect}
                  onClick={() => click(() => setNotice(null))}
                  onPressedChange={(pressed) => setPressedControl(
                    pressed ? 'message-secondary' : null,
                  )}
                />
              ) : null}
            </>
          ) : surface.kind === 'dialogue' ? (
            <DialogueActions
              chat={chat}
              gold={economy.gold}
              interaction={surface.interaction}
              pendingSelection={pendingNpcSelection !== null}
              selectorRows={selectorRows}
              storyOffice={storyOffice}
              onAccelerate={() => setChat((current) => current.acceleratedAtMs === null
                ? { ...current, acceleratedAtMs: performance.now() }
                : current)}
              onAdvance={advanceChat}
              onChoice={(choice) => click(() => {
                if (surface.source === 'college-intro' && !collegeIntroAcknowledgedRef.current) {
                  collegeIntroAcknowledgedRef.current = true
                  onAction({ type: 'acknowledge-college-intro-dialogue' })
                  onSurfaceChange({ ...surface, source: 'world' })
                }
                if (choice.kind === 'question') {
                  const answer = hubNpcQuestion(
                    surface.interaction,
                    choice.key,
                    storyOffice,
                  )
                  if (answer) beginChatContent(answer)
                  return
                }
                const selector = hubNpcSelectorContent(choice.selector)
                if (selector) {
                  beginChatContent(selector)
                  return
                }
                onSurfaceChange({
                  kind: 'service',
                  source: surface.source === 'college-intro' ? 'world' : surface.source,
                  trader: choice.selector as HubTraderId,
                })
              })}
              onDone={() => click(() => {
                dismissOrCloseChat()
              })}
              onSelectorHighlight={setHighlightedNpcSelectorId}
              onSelectRow={(selector, id) => {
                if (pendingNpcSelection) return
                const action = hubNpcSelectorAction(selector, id)
                setPendingNpcSelection({ action: action.type, id, selector })
                audio.playSound('click')
                onAction(action)
              }}
              onSelectorOffset={(selectorOffset) => setChat(current => ({
                ...current,
                selectorOffset,
                selectorScroll: 0,
              }))}
              onSelectorScroll={(selectorScroll) => setChat(current => ({
                ...current,
                selectorScroll,
              }))}
              onSelectorDone={() => click(() => beginChatContent({ kind: 'choices' }))}
            />
          ) : surface.kind === 'service' ? (
            <ServiceActions
              beltRects={inventoryBeltRects}
              economy={economy}
              inventorySelection={inventorySelection}
              selection={serviceSelection}
              trader={surface.trader}
              onAction={(action) => {
                if (action.type.startsWith('buy-')) audio.playSound('click')
                onAction(action)
              }}
              onInventoryAction={(action) => {
                if (action.type !== 'consume' && action.type !== 'transfer'
                  && action.type !== 'unforge' && action.type !== 'equip'
                  && action.type !== 'move-inventory-item') audio.playSound('click')
                onAction(action)
              }}
              onBeltBind={(itemId, slot) => {
                audio.playSound('pick-skill')
                onAction({ itemId, slot, type: 'bind-belt-item' })
              }}
              onOpenSack={onOpenSack}
              onClose={() => {
                audio.playSound('open-panel')
                onClose()
              }}
              onDragChange={setInventoryDrag}
              onDragMove={(point) => rendererRef.current?.moveDrag(point)}
              onInsufficientGold={() => setNotice(HUB_DOWSING_INSUFFICIENT_GOLD)}
              onInventorySelect={(next) => {
                audio.playSound('click')
                setInventorySelection(next)
              }}
              onInteractionSound={(cue) => {
                if (cue === 'storage-drag-start' || cue === 'shop-activation') audio.playSound('click')
              }}
              onFocusInspection={setServiceFocusInspection}
              onHoverInspection={setServiceHoverInspection}
              onNotice={setNotice}
              onFlyby={startInventoryFlyby}
              onMoveSound={(cue, playbackRate) => audio.playSound(cue, { playbackRate })}
              onOpenDye={openDye}
              onPressedControl={setPressedControl}
              sackPath={sackPath}
              transitionLocked={sackTransition !== null || inventoryFlyby !== null}
              onSelect={setServiceSelection}
            />
          ) : (
            <InventoryActions
              beltRects={inventoryBeltRects}
              economy={economy}
              selection={inventorySelection}
              onAction={(action) => {
                if (action.type !== 'consume' && action.type !== 'unforge'
                  && action.type !== 'bind-belt-item' && action.type !== 'equip'
                  && action.type !== 'move-inventory-item') {
                  audio.playSound('click')
                }
                onAction(action)
              }}
              onBeltBind={(itemId, slot) => {
                audio.playSound('pick-skill')
                onAction({ itemId, slot, type: 'bind-belt-item' })
              }}
              onDragChange={setInventoryDrag}
              onDragMove={(point) => rendererRef.current?.moveDrag(point)}
              onNotice={setNotice}
              onFlyby={startInventoryFlyby}
              onMoveSound={(cue, playbackRate) => audio.playSound(cue, { playbackRate })}
              onOpenDye={openDye}
              onOpenSack={onOpenSack}
              onSelect={(next) => {
                audio.playSound('click')
                setInventorySelection(next)
              }}
              sackPath={sackPath}
              transitionLocked={sackTransition !== null || inventoryFlyby !== null}
            />
          )}
          {(surface.kind === 'inventory'
            || (surface.kind === 'service' && surface.trader !== 'hagatha'))
            && !notice && !dyeModal ? (
              <InventoryStatsActions
                companion={surface.kind === 'service'}
                economy={economy}
                page={statsPage}
                onInspectionFocus={setServiceFocusInspection}
                onInspectionHover={setServiceHoverInspection}
                onPage={(nextPage) => {
                  setServiceFocusInspection(null)
                  setServiceHoverInspection(null)
                  setStatsPage(nextPage)
                }}
                onRemove={perkRemovalEnabled
                  ? (selector) => {
                      audio.playSound('click')
                      onAction({ type: 'remove-hagatha', selector })
                    }
                  : null}
              />
            ) : null}
          {(surface.kind === 'inventory' || surface.kind === 'service')
            && !notice && !dyeModal ? (
              <InventoryBeltActions
                audio={audio}
                belt={belt}
                disabled={sackTransition !== null || inventoryFlyby !== null
                  || !onUnassignBeltEntry}
                onPullOff={(slot) => onUnassignBeltEntry?.(slot)}
                rects={inventoryBeltRects}
              />
            ) : null}
          {semanticTooltip ? (
            <span className="hub-native-ui-semantic" role="tooltip">{semanticTooltip}</span>
          ) : null}
          {surface.kind === 'inventory' && !notice && !dyeModal ? (
            <NativeAction
              data={{ 'data-inventory-skills': 'true' }}
              label="Open skills"
              rect={inventorySkillsRect}
              onClick={onOpenSkills}
            />
          ) : null}
          {(surface.kind === 'inventory' || surface.kind === 'service')
            && !notice && !dyeModal ? (
            <NativeAction
              data={{ 'data-inventory-resume': 'true' }}
              gameBack
              label={sackPath.length > 0 ? 'Return to parent inventory' : 'Close inventory'}
              rect={inventoryResumeRect}
              onClick={onInventoryBack}
            />
          ) : surface.kind === 'dialogue' ? (
            <button
              className="hub-native-ui-semantic"
              data-game-back="true"
              onClick={onClose}
              type="button"
            >
              Close {label}
            </button>
          ) : null}
        </div>
        {rendererState === 'error' ? (
          <p className="hub-native-ui-error" role="alert">Native inventory renderer unavailable.</p>
        ) : null}
      </section>
    </div>
  )
}

function DialogueActions({
  chat,
  gold,
  interaction,
  onAccelerate,
  onAdvance,
  onChoice,
  onDone,
  onSelectorHighlight,
  onSelectRow,
  onSelectorDone,
  onSelectorOffset,
  onSelectorScroll,
  pendingSelection,
  selectorRows,
  storyOffice,
}: {
  chat: HubNpcChatPresentation
  gold: number
  onAccelerate: () => void
  onAdvance: () => void
  onChoice: (choice: HubNpcChatChoice) => void
  onDone: () => void
  onSelectorHighlight: (id: number | ModBoastSelection | null) => void
  onSelectRow: (
    selector: 'boast' | 'books' | 'teacher-spells',
    id: number | ModBoastSelection,
  ) => void
  onSelectorDone: () => void
  onSelectorOffset: (offset: number) => void
  onSelectorScroll: (scroll: number) => void
  pendingSelection: boolean
  selectorRows: readonly HubNpcSelectorRow[]
  storyOffice: boolean
  interaction: HubInteractionId
}) {
  const selectorPointerRef = useRef<{
    distance: number
    lastY: number
    moved: boolean
    pointerId: number
  } | null>(null)
  const suppressSelectorClickRef = useRef(false)

  if (chat.content.kind === 'speech') {
    const speech = chat.content
    return (
      <div className="hub-native-dialogue-actions">
        <div className="hub-native-ui-semantic">
          {speech.lines.map((line, index) => <p key={`${speech.key}-${index}`}>{line}</p>)}
        </div>
        <NativeAction
          label="Accelerate dialogue"
          rect={[
            HUB_CHAT_PANEL.contentLeft,
            HUB_CHAT_PANEL.contentTop,
            HUB_CHAT_PANEL.contentWidth,
            HUB_CHAT_PANEL.contentHeight,
          ]}
          onClick={onAccelerate}
        />
        <NativeAction label="Skip" rect={HUB_CHAT_PANEL.doneRect} onClick={onAdvance} />
      </div>
    )
  }

  if (chat.content.kind === 'selector') {
    const selector = chat.content.selector
    if (selector === 'boast' && selectorRows.length > 5) {
      return (
        <ExpandedBoastSelectorActions
          offset={chat.selectorOffset}
          onDone={onSelectorDone}
          onHighlight={onSelectorHighlight}
          onOffset={onSelectorOffset}
          onSelect={id => onSelectRow(selector, id)}
          pendingSelection={pendingSelection}
          rows={selectorRows}
        />
      )
    }
    const scroll = hubNpcSelectorClampScroll(chat.selectorScroll, selectorRows.length)
    const visibleRows = hubNpcSelectorVisibleRows(selectorRows.length, scroll)
    const wheel = (event: ReactWheelEvent<HTMLElement>) => {
      if (event.deltaY === 0) return
      onSelectorScroll(hubNpcSelectorWheelScroll(scroll, event.deltaY, selectorRows.length))
    }
    const beginPointer = (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      selectorPointerRef.current = {
        distance: 0,
        lastY: pointerStagePosition(event).y,
        moved: false,
        pointerId: event.pointerId,
      }
      suppressSelectorClickRef.current = false
    }
    const movePointer = (event: ReactPointerEvent<HTMLElement>) => {
      const press = selectorPointerRef.current
      if (!press || press.pointerId !== event.pointerId) return
      const nextY = pointerStagePosition(event).y
      const deltaY = nextY - press.lastY
      press.lastY = nextY
      press.distance += Math.abs(deltaY)
      if (!press.moved && press.distance >= 4) {
        press.moved = true
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      if (deltaY !== 0) {
        onSelectorScroll(hubNpcSelectorDragScroll(scroll, deltaY, selectorRows.length))
      }
    }
    const finishPointer = (event: ReactPointerEvent<HTMLElement>) => {
      const press = selectorPointerRef.current
      if (!press || press.pointerId !== event.pointerId) return
      suppressSelectorClickRef.current = press.moved
      if (press.moved) window.setTimeout(() => { suppressSelectorClickRef.current = false }, 0)
      selectorPointerRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }
    const keyScroll = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const delta = event.key === 'ArrowUp'
        ? -HUB_NPC_SELECTOR.wheelStep
        : event.key === 'ArrowDown'
          ? HUB_NPC_SELECTOR.wheelStep
          : event.key === 'PageUp'
            ? -HUB_NPC_SELECTOR.viewportRect[3]
            : event.key === 'PageDown'
              ? HUB_NPC_SELECTOR.viewportRect[3]
              : 0
      if (delta === 0) return
      event.preventDefault()
      onSelectorScroll(hubNpcSelectorClampScroll(scroll + delta, selectorRows.length))
    }
    return (
      <section
        className="hub-native-dialogue-actions"
        aria-label={hubNpcSelectorTitle(selector)}
        data-native-selector={selector}
        data-native-selector-scroll={scroll}
        onLostPointerCapture={() => { selectorPointerRef.current = null }}
        onPointerCancel={finishPointer}
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={finishPointer}
        onWheel={wheel}
      >
        <span className="hub-native-ui-semantic" role="status">
          {visibleRows.length === 0 && selector === 'teacher-spells'
            ? 'ALL SPELLS ALREADY BOUGHT!'
            : `${hubNpcSelectorTitle(selector)}. ${selectorRows.length} entries.`}
        </span>
        <NativeAction
          data={{ 'data-native-selector-swipebox': 'true' }}
          label={`Scroll ${hubNpcSelectorTitle(selector)}`}
          rect={HUB_NPC_SELECTOR.viewportRect}
          onKeyDown={keyScroll}
        />
        {visibleRows.map(({ index, rect }) => {
          const row = selectorRows[index]!
          return (
          <NativeAction
            key={`${selector}-${hubNpcSelectorRowKey(row)}`}
            data={{
              'data-native-selector-id': typeof row.id === 'number' ? row.id : row.id.contentId,
              'data-native-selector-kind': selector,
              'data-native-selector-mod-id': typeof row.id === 'number' ? '' : row.id.modId,
              'data-native-selector-price': row.price ?? '',
              'data-native-selector-affordable': row.price === null || gold >= row.price
                ? 'true'
                : 'false',
            }}
            disabled={pendingSelection}
            label={`${row.label}${row.price === null ? '' : `, ${row.price} gold`}. ${row.detail}`}
            rect={rect}
            onBlur={() => onSelectorHighlight(null)}
            onClick={() => {
              if (suppressSelectorClickRef.current) {
                return
              }
              onSelectRow(selector, row.id)
            }}
            onFocus={() => onSelectorHighlight(row.id)}
            onKeyDown={keyScroll}
            onPointerEnter={() => onSelectorHighlight(row.id)}
            onPointerLeave={() => onSelectorHighlight(null)}
          />
          )
        })}
        <NativeAction gameBack label="Done" rect={HUB_NPC_SELECTOR.doneRect} onClick={onSelectorDone} />
      </section>
    )
  }

  const choices = hubNpcChatChoices(interaction, storyOffice)
  return (
    <div className="hub-native-dialogue-actions">
      {choices.map((choice, index) => (
        <NativeAction
          key={choice.kind === 'question' ? choice.key : choice.selector}
          data={{
            'data-native-chat-choice': choice.kind,
            'data-native-chat-key': choice.kind === 'question' ? choice.key : choice.selector,
            'data-service-trader': choice.kind === 'command'
              && ['fomentius', 'hagatha', 'luthacus', 'shlorio'].includes(choice.selector)
              ? choice.selector
              : '',
          }}
          label={choice.label}
          rect={[590, 145 + index * 52, 420, 45]}
          onClick={() => onChoice(choice)}
        />
      ))}
      <NativeAction gameBack label="Done" rect={HUB_CHAT_PANEL.doneRect} onClick={onDone} />
    </div>
  )
}

function ExpandedBoastSelectorActions({
  offset,
  onDone,
  onHighlight,
  onOffset,
  onSelect,
  pendingSelection,
  rows,
}: {
  offset: number
  onDone: () => void
  onHighlight: (id: number | ModBoastSelection | null) => void
  onOffset: (offset: number) => void
  onSelect: (id: number | ModBoastSelection) => void
  pendingSelection: boolean
  rows: readonly HubNpcSelectorRow[]
}) {
  const pageSize = 5
  const maximumOffset = Math.max(0, Math.floor((rows.length - 1) / pageSize) * pageSize)
  const boundedOffset = Math.min(offset, maximumOffset)
  const visibleRows = rows.slice(boundedOffset, boundedOffset + pageSize)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageIndex = Math.floor(boundedOffset / pageSize)
  const plan = planNativeUiBoastMenu({
    height: HUB_NATIVE_UI_SIZE.height,
    pageCount,
    pageIndex,
    rows: visibleRows.map(row => ({
      detail: row.detail,
      id: hubNpcSelectorRowKey(row),
      label: row.label,
      ...(row.boastIcon?.kind === 'stock' ? { stockIconRecord: row.boastIcon.record } : {}),
    })),
    width: HUB_NATIVE_UI_SIZE.width,
  })
  return (
    <section
      aria-label={hubNpcSelectorTitle('boast')}
      className="hub-native-dialogue-actions"
      data-native-selector="boast"
      data-native-selector-offset={boundedOffset}
      data-native-selector-scroll="0"
    >
      <span className="hub-native-ui-semantic" role="status">
        {`${hubNpcSelectorTitle('boast')}. ${rows.length} entries.`}
      </span>
      {visibleRows.map((row, index) => (
        <NativeAction
          data={{
            'data-native-selector-id': typeof row.id === 'number' ? row.id : row.id.contentId,
            'data-native-selector-kind': 'boast',
            'data-native-selector-mod-id': typeof row.id === 'number' ? '' : row.id.modId,
            'data-native-selector-price': '',
          }}
          disabled={pendingSelection}
          key={hubNpcSelectorRowKey(row)}
          label={`${row.label}. ${row.detail}`}
          onBlur={() => onHighlight(null)}
          onClick={() => onSelect(row.id)}
          onFocus={() => onHighlight(row.id)}
          onPointerEnter={() => onHighlight(row.id)}
          onPointerLeave={() => onHighlight(null)}
          rect={nativeUiActionRect(plan.rowBounds[index]!.bounds)}
        />
      ))}
      {boundedOffset > 0 ? (
        <NativeAction
          label="Previous entries"
          onClick={() => {
            onHighlight(null)
            onOffset(Math.max(0, boundedOffset - pageSize))
          }}
          rect={nativeUiActionRect(plan.actions.find(({ id }) => id === 'previous')!.bounds)}
        />
      ) : null}
      {boundedOffset < maximumOffset ? (
        <NativeAction
          label="More entries"
          onClick={() => {
            onHighlight(null)
            onOffset(Math.min(maximumOffset, boundedOffset + pageSize))
          }}
          rect={nativeUiActionRect(plan.actions.find(({ id }) => id === 'next')!.bounds)}
        />
      ) : null}
      <NativeAction
        gameBack
        label="Done"
        onClick={onDone}
        rect={nativeUiActionRect(plan.doneBounds)}
      />
    </section>
  )
}

interface StatsPointerPress {
  readonly pointerId: number
  readonly start: { readonly x: number; readonly y: number }
}

function InventoryStatsActions({
  companion,
  economy,
  onInspectionFocus,
  onInspectionHover,
  onPage,
  onRemove,
  page,
}: {
  companion: boolean
  economy: ProtocolPlayerEconomy
  onInspectionFocus: (inspection: HubServiceInspectionModel | null) => void
  onInspectionHover: (inspection: HubServiceInspectionModel | null) => void
  onPage: (page: number) => void
  onRemove: ((selector: number) => void) | null
  page: number
}) {
  const pressRef = useRef<StatsPointerPress | null>(null)
  const clipRect = companion
    ? HUB_INVENTORY_STATS_PAGES.companionClipRect
    : HUB_INVENTORY_STATS_PAGES.standaloneClipRect
  const step = (delta: -1 | 1) => {
    const next = Math.max(0, Math.min(HUB_INVENTORY_STATS_PAGES.pageCount - 1, page + delta))
    if (next !== page) onPage(next)
  }
  const clearPress = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || (event && event.pointerId !== press.pointerId)) return
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pressRef.current = null
  }
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    const point = pointerStagePosition(event)
    const deltaY = point.y - press.start.y
    clearPress(event)
    if (Math.abs(deltaY) <= HUB_INVENTORY_STATS_PAGES.dragThresholdPixels) return
    step(deltaY < 0 ? 1 : -1)
  }
  return (
    <section aria-label="Player Stats Pages" data-native-stats-page={page}>
      <NativeAction
        data={{ 'data-native-stats-swipe': 'true' }}
        label="Scroll player stats"
        rect={clipRect}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.repeat) return
          if (event.key === 'ArrowUp' || event.key === 'PageUp') {
            event.preventDefault()
            step(-1)
          } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
            event.preventDefault()
            step(1)
          }
        }}
        onLostPointerCapture={() => { pressRef.current = null }}
        onPointerCancel={clearPress}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          pressRef.current = {
            pointerId: event.pointerId,
            start: pointerStagePosition(event),
          }
        }}
        onPointerUp={finish}
        onWheel={(event) => {
          if (event.deltaY === 0) return
          event.preventDefault()
          step(event.deltaY > 0 ? 1 : -1)
        }}
      />
      {(['up', 'down'] as const).map((direction) => {
        const rect = hubInventoryStatsArrowRect(page, direction, companion)
        return rect ? (
          <NativeAction
            key={direction}
            data={{ 'data-native-stats-arrow': direction }}
            label={`${direction === 'up' ? 'Previous' : 'Next'} player stats page`}
            rect={rect}
            onClick={() => step(direction === 'up' ? -1 : 1)}
          />
        ) : null
      })}
      {page === 2 ? economy.ownedPerkSelectors.slice(0, 9).map((selector, index) => {
        const [left, top, width, height] = hubOwnedPerkSlotRect(index)
        const inspection = { index, kind: 'owned-perk' as const, selector }
        return (
          <NativeAction
            key={`${selector}-${index}`}
            data={{ 'data-owned-hagatha-selector': selector }}
            label={selector === 27 || onRemove === null
              ? `Inspect ${HAGATHA_PERKS[selector]!.name}`
              : `Remove ${HAGATHA_PERKS[selector]!.name}`}
            rect={[left - (companion ? 0 : 53), top, width, height]}
            onBlur={() => onInspectionFocus(null)}
            onClick={selector === 27 || onRemove === null ? undefined : () => onRemove(selector)}
            onFocus={() => onInspectionFocus(inspection)}
            onPointerEnter={() => onInspectionHover(inspection)}
            onPointerLeave={() => onInspectionHover(null)}
          />
        )
      }) : null}
    </section>
  )
}

function ServiceActions({
  beltRects,
  economy,
  inventorySelection,
  onAction,
  onBeltBind,
  onClose,
  onDragChange,
  onDragMove,
  onInsufficientGold,
  onInventoryAction,
  onInventorySelect,
  onInteractionSound,
  onFocusInspection,
  onFlyby,
  onHoverInspection,
  onMoveSound,
  onNotice,
  onOpenDye,
  onOpenSack,
  onPressedControl,
  onSelect,
  selection,
  sackPath,
  trader,
  transitionLocked,
}: {
  beltRects: readonly NativeHudRect[]
  economy: ProtocolPlayerEconomy
  inventorySelection: HubInventorySelectionModel | null
  onAction: (action: HubInventoryAction) => void
  onBeltBind: (itemId: number, slot: number) => void
  onClose: () => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onInsufficientGold: () => void
  onInventoryAction: (action: HubInventoryAction) => void
  onInventorySelect: (selection: HubInventorySelectionModel | null) => void
  onInteractionSound: (cue: 'shop-activation' | 'storage-drag-start') => void
  onFocusInspection: (inspection: HubServiceInspectionModel | null) => void
  onFlyby: (request: InventoryFlybyRequest) => void
  onHoverInspection: (inspection: HubServiceInspectionModel | null) => void
  onMoveSound: (
    cue: 'backpack-open' | 'bad-action' | 'click',
    playbackRate: number,
  ) => void
  onNotice: (notice: HubInventoryUiNotice) => void
  onOpenDye: (dyeItemId: number) => void
  onOpenSack: (sackId: number) => void
  onPressedControl: (control: HubInventoryPressedControl) => void
  onSelect: (selection: HubServiceSelection | null) => void
  selection: HubServiceSelection | null
  sackPath: readonly number[]
  trader: HubTraderId
  transitionLocked: boolean
}) {
  const storageDropRect = [
    HUB_SHOP_GRID.left,
    HUB_SHOP_GRID.top,
    (HUB_SHOP_GRID.columns - 1) * HUB_SHOP_GRID.pitchX + HUB_SHOP_GRID.cellSize,
    (HUB_SHOP_GRID.rows - 1) * HUB_SHOP_GRID.pitchY + HUB_SHOP_GRID.cellSize,
  ] as const
  const companionInventory = (
    <InventoryActions
      beltRects={beltRects}
      companion
      economy={economy}
      selection={inventorySelection}
      storageDropRect={trader === 'luthacus' ? storageDropRect : null}
      onAction={onInventoryAction}
      onBeltBind={onBeltBind}
      onDragChange={onDragChange}
      onDragMove={onDragMove}
      onFlyby={onFlyby}
      onMoveSound={onMoveSound}
      onNotice={onNotice}
      onOpenDye={onOpenDye}
      onOpenSack={onOpenSack}
      onSelect={onInventorySelect}
      sackPath={sackPath}
      transitionLocked={transitionLocked}
    />
  )

  let serviceActions: ReactNode
  if (trader === 'luthacus') {
    serviceActions = (
      <InventoryShopStorageActions
        economy={economy}
        selection={selection}
        onAction={onAction}
        onClose={onClose}
        onDragChange={onDragChange}
        onDragMove={onDragMove}
        onInteractionSound={onInteractionSound}
        onFocusInspection={onFocusInspection}
        onHoverInspection={onHoverInspection}
        onSelect={onSelect}
      />
    )
  } else if (trader === 'shlorio' && economy.dowsingOffers.length === 0) {
    serviceActions = (
      <>
        <NativeAction
          label={`DOWSE ${economy.dowsingFee.toLocaleString()} gold`}
          rect={HUB_DOWSING_PREROLL.buttonActionRect}
          onClick={() => {
            onPressedControl(null)
            if (economy.gold < economy.dowsingFee) onInsufficientGold()
            else onAction({ type: 'dowse' })
          }}
          onPressedChange={(pressed) => onPressedControl(pressed ? 'dowsing' : null)}
        />
        <NativeAction gameBack label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
      </>
    )
  } else if (trader === 'hagatha') {
    serviceActions = (
      <>
        {economy.hagathaOffers.map((offer, index) => (
          <ShopAction
            key={offer.selector}
            index={index}
            label={`Buy ${offer.name} for ${offer.price} gold`}
            data={{ 'data-hagatha-selector': offer.selector }}
            price={offer.price}
            selected={selection?.id === offer.selector && selection.owner === null}
            onBlur={() => onFocusInspection(null)}
            onClick={() => activateSelection(
              selection,
              { id: offer.selector, owner: null },
              (next) => {
                onInteractionSound('shop-activation')
                onSelect(next)
              },
              () => onAction({ type: 'buy-hagatha', selector: offer.selector }),
            )}
            onFocus={() => onFocusInspection({
              id: offer.selector,
              kind: 'store-item',
              owner: null,
            })}
            onPointerEnter={() => onHoverInspection({
              id: offer.selector,
              kind: 'store-item',
              owner: null,
            })}
            onPointerLeave={() => onHoverInspection(null)}
          />
        ))}
        <EmptyStoreGridActions
          fromIndex={economy.hagathaOffers.length}
          onClear={() => {
            if (selection === null) return
            onInteractionSound('shop-activation')
            onSelect(null)
          }}
        />
        <span className="hub-native-ui-semantic hub-charm-capacity">
          Charms and curses: {economy.ownedPerkSelectors.length} / {economy.charmCapacity}
        </span>
        <NativeAction gameBack label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
      </>
    )
  } else {
    const items = trader === 'fomentius'
      ? economy.fomentiusStock
      : dowsingItems(economy)
    serviceActions = (
      <>
        {items.map((item, index) => (
          <ShopAction
            key={item.id}
            data={{ 'data-item-id': item.id }}
            index={index}
            label={`Buy ${item.name} for ${item.price} gold`}
            price={item.price}
            dowsing={trader === 'shlorio'}
            selected={selection?.id === item.id && selection.owner === null}
            onBlur={() => onFocusInspection(null)}
            onClick={() => activateSelection(
              selection,
              { id: item.id, owner: null },
              (next) => {
                onInteractionSound('shop-activation')
                onSelect(next)
              },
              () => onAction(trader === 'fomentius'
                ? { type: 'buy-fomentius', itemId: item.id }
                : { type: 'buy-dowsing', offerId: item.id }),
            )}
            onFocus={() => onFocusInspection({ id: item.id, kind: 'store-item', owner: null })}
            onPointerEnter={() => onHoverInspection({ id: item.id, kind: 'store-item', owner: null })}
            onPointerLeave={() => onHoverInspection(null)}
          />
        ))}
        <EmptyStoreGridActions
          dowsing={trader === 'shlorio'}
          fromIndex={items.length}
          onClear={() => {
            if (selection === null) return
            onInteractionSound('shop-activation')
            onSelect(null)
          }}
        />
        <NativeAction gameBack label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
      </>
    )
  }

  return (
    <>
      {companionInventory}
      {trader === 'hagatha' ? (
        <section aria-label="Owned Charms and Curses">
          {economy.ownedPerkSelectors.slice(0, 9).map((selector, index) => (
            <NativeAction
              key={`${selector}-${index}`}
              data={{ 'data-owned-hagatha-selector': selector }}
              label={selector === 27
                ? `Inspect ${HAGATHA_PERKS[selector]!.name}`
                : `Remove ${HAGATHA_PERKS[selector]!.name}`}
              rect={hubOwnedPerkSlotRect(index)}
              onBlur={() => onFocusInspection(null)}
              onFocus={() => onFocusInspection({
                index,
                kind: 'owned-perk',
                selector,
              })}
              onPointerEnter={() => onHoverInspection({
                index,
                kind: 'owned-perk',
                selector,
              })}
              onPointerLeave={() => onHoverInspection(null)}
              onClick={selector === 27 ? undefined : () => {
                onInteractionSound('shop-activation')
                onAction({ type: 'remove-hagatha', selector })
              }}
            />
          ))}
        </section>
      ) : null}
      {serviceActions}
    </>
  )
}

function InventoryShopStorageActions({
  economy,
  onAction,
  onClose,
  onDragChange,
  onDragMove,
  onFocusInspection,
  onHoverInspection,
  onInteractionSound,
  onSelect,
  selection,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onFocusInspection: (inspection: HubServiceInspectionModel | null) => void
  onHoverInspection: (inspection: HubServiceInspectionModel | null) => void
  onInteractionSound: (cue: 'shop-activation' | 'storage-drag-start') => void
  onSelect: (selection: HubServiceSelection | null) => void
  selection: HubServiceSelection | null
}) {
  const pressRef = useRef<StoragePointerPress | null>(null)
  const lastActivationRef = useRef<StorageActivation | null>(null)
  const projectedStorage = projectInventoryRootSlots(economy.storage)
    .filter(({ slot }) => slot < HUB_SHOP_GRID.retainedCapacity)
    .map(({ item, slot }) => ({ depth: 0, item, parentSackId: null, slot }))

  const clearStorageSelection = () => {
    pressRef.current = null
    lastActivationRef.current = null
    onDragChange(null)
    if (selection === null) return
    onInteractionSound('shop-activation')
    onSelect(null)
  }

  const sourceIsSelected = (itemId: number) => (
    selection?.id === itemId && selection.owner === 'storage'
  )
  const selectSource = (itemId: number) => (
    onSelect({ id: itemId, owner: 'storage' })
  )

  const beginPointer = (itemId: number) => (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (event.pointerType === 'touch') {
      const nowMs = performance.now()
      const previous = lastActivationRef.current
      const doubled = previous
        && previous.itemId === itemId
        && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs
      onInteractionSound('shop-activation')
      if (doubled) {
        pressRef.current = null
        lastActivationRef.current = null
        onDragChange(null)
        onAction({
          type: 'transfer',
          direction: 'to-backpack',
          gesture: 'double-activation',
          itemId,
        })
        return
      }
      lastActivationRef.current = { atMs: nowMs, itemId }
      if (!sourceIsSelected(itemId)) selectSource(itemId)
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    pressRef.current = {
      activeDrag: false,
      itemId,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      start: pointerStagePosition(event),
    }
  }

  const movePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    const point = pointerStagePosition(event)
    if (!press.activeDrag) {
      const dx = point.x - press.start.x
      const dy = point.y - press.start.y
      if (Math.hypot(dx, dy) < HUB_INVENTORY_INTERACTION.dragThresholdPixels) return
      press.activeDrag = true
      selectSource(press.itemId)
      onInteractionSound('storage-drag-start')
      onDragChange({
        equipmentSlot: null,
        itemId: press.itemId,
        owner: 'storage',
        pointer: point,
      })
    }
    onDragMove(point)
  }

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointerStagePosition(event)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pressRef.current = null
    if (press.activeDrag) {
      if (press.pointerType === 'touch') lastActivationRef.current = null
      onDragChange(null)
      selectSource(press.itemId)
      const validDrop = pointInRect(point, [0, 490, 1600, 310])
      if (validDrop) onAction({
        type: 'transfer',
        direction: 'to-backpack',
        gesture: 'drag',
        itemId: press.itemId,
      })
      return
    }

    if (press.pointerType === 'touch') return

    const nowMs = performance.now()
    const previous = lastActivationRef.current
    const doubled = previous
      && previous.itemId === press.itemId
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs
    onInteractionSound('shop-activation')
    if (doubled) {
      lastActivationRef.current = null
      onAction({
        type: 'transfer',
        direction: 'to-backpack',
        gesture: 'double-activation',
        itemId: press.itemId,
      })
    } else {
      lastActivationRef.current = { atMs: nowMs, itemId: press.itemId }
      if (!sourceIsSelected(press.itemId)) selectSource(press.itemId)
    }
  }

  const cancelPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (press?.pointerId !== event.pointerId) return
    if (press.pointerType === 'touch' && press.activeDrag) lastActivationRef.current = null
    pressRef.current = null
    onDragChange(null)
  }

  const keyboardActivate = (itemId: number) => (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    const nowMs = performance.now()
    const previous = lastActivationRef.current
    const doubled = previous
      && previous.itemId === itemId
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs
    onInteractionSound('shop-activation')
    if (doubled) {
      lastActivationRef.current = null
      onAction({
        type: 'transfer',
        direction: 'to-backpack',
        gesture: 'double-activation',
        itemId,
      })
    } else {
      lastActivationRef.current = { atMs: nowMs, itemId }
      selectSource(itemId)
    }
  }

  return (
    <>
      <section aria-label="Scavenged Goods">
        {projectedStorage.map(({ depth, item, parentSackId, slot }) => {
          const position = hubShopSlotPosition(slot)
          return (
            <NativeAction
              key={item.id}
              data={{
                'data-inventory-item-id': item.id,
                'data-inventory-depth': depth,
                'data-inventory-owner': 'storage',
                'data-inventory-slot': slot,
                'data-parent-sack-id': parentSackId ?? '',
                'data-selected': sourceIsSelected(item.id) ? 'true' : 'false',
              }}
              label={`${item.name}, quantity ${item.quantity}`}
              rect={[
                position.x,
                position.y,
                HUB_SHOP_GRID.cellSize,
                HUB_SHOP_GRID.cellSize,
              ]}
              onBlur={() => onFocusInspection(null)}
              onFocus={() => onFocusInspection({
                id: item.id,
                kind: 'store-item',
                owner: 'storage',
              })}
              onKeyDown={keyboardActivate(item.id)}
              onPointerCancel={cancelPointer}
              onPointerDown={beginPointer(item.id)}
              onPointerEnter={() => onHoverInspection({
                id: item.id,
                kind: 'store-item',
                owner: 'storage',
              })}
              onPointerLeave={() => onHoverInspection(null)}
              onPointerMove={movePointer}
              onPointerUp={finishPointer}
            />
          )
        })}
        <EmptyStoreGridActions
          fromIndex={0}
          occupiedSlots={projectedStorage.map(({ slot }) => slot)}
          onClear={clearStorageSelection}
        />
      </section>
      <NativeAction gameBack label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
    </>
  )
}

interface StoragePointerPress {
  activeDrag: boolean
  readonly itemId: number
  readonly pointerId: number
  readonly pointerType: string
  readonly start: { readonly x: number; readonly y: number }
}

interface StorageActivation {
  readonly atMs: number
  readonly itemId: number
}

function DyeClothingActions({
  economy,
  modal,
  onCancel,
  onCommit,
  onSelectSwatch,
  onSelectTarget,
}: {
  economy: ProtocolPlayerEconomy
  modal: HubInventoryDyeModalModel
  onCancel: () => void
  onCommit: (layer: 'cloth' | 'trim') => void
  onSelectSwatch: (row: number) => void
  onSelectTarget: (targetItemId: number) => void
}) {
  const projected = projectInventoryRootSlots(
    inventoryItemsAtSackPath(economy.backpack, modal.path) ?? [],
  )
    .filter(({ slot }) => (
      slot < HUB_INVENTORY_GRID.capacity - (modal.path.length > 0 ? 1 : 0)
    ))
    .map(({ item, slot }) => ({
      depth: modal.path.length,
      item,
      parentSackId: modal.path.at(-1) ?? null,
      slot,
      visibleSlot: hubInventoryVisibleSlot(slot, modal.path.length > 0),
    }))
  const eligibleIds = new Set(
    inventoryDyeableClothingItems(economy.backpack).map(({ item }) => item.id),
  )
  const targetSlot = modal.targetItemId === null
    ? null
    : projected.find(({ item }) => item.id === modal.targetItemId)?.slot ?? null
  const blocked = modal.pending || modal.closingAtMs !== null
  const phase = modal.targetItemId === null
    ? modal.swatchRows.length === 0 ? 'mix' : 'target'
    : 'layer'

  return (
    <section aria-label="Fabric Dye" data-native-dye-phase={phase}>
      <span className="hub-native-ui-semantic" role="status">
        Fabric Dye. {modal.swatchRows.length} colors mixed.
        {phase === 'mix' ? ' Choose a color.' : ''}
        {phase === 'target' ? ' Choose a backpack hat or robe.' : ''}
        {phase === 'layer' ? ' Choose dye cloth or dye trim.' : ''}
      </span>
      {modal.targetItemId === null ? (
        <>
          {Array.from({ length: HUB_DYE_CLOTHING.swatchCount }, (_, row) => (
            <NativeAction
              key={`dye-swatch-${row}`}
              data={{
                'data-native-dye-swatch': row,
                'data-selected-pulse': modal.selectedRow === row ? 'true' : 'false',
              }}
              disabled={blocked || modal.swatchRows.length >= MAX_NATIVE_DYE_SELECTIONS}
              label={`Add dye color ${row + 1}`}
              rect={hubDyeSwatchRect(row)}
              onClick={() => onSelectSwatch(row)}
            />
          ))}
          {modal.swatchRows.length > 0
            ? projected.map(({ depth, item, parentSackId, visibleSlot }) => {
                if (!eligibleIds.has(item.id)) return null
                const position = hubInventorySlotPosition(visibleSlot)
                return (
                  <NativeAction
                    key={`dye-target-${item.id}`}
                    data={{
                      'data-inventory-depth': depth,
                      'data-native-dye-target': item.id,
                      'data-parent-sack-id': parentSackId ?? '',
                    }}
                    disabled={blocked}
                    label={`Dye ${item.name}`}
                    rect={[
                      position.x,
                      position.y,
                      HUB_INVENTORY_GRID.cellSize,
                      HUB_INVENTORY_GRID.cellSize,
                    ]}
                    onClick={() => onSelectTarget(item.id)}
                  />
                )
              })
            : null}
        </>
      ) : targetSlot !== null ? (
        <>
          <NativeAction
            data={{
              'data-native-dye-layer': 'cloth',
              'data-native-dye-target': modal.targetItemId,
            }}
            disabled={blocked}
            label="Dye cloth"
            rect={hubDyeItemLayerRects(hubInventoryVisibleSlot(
              targetSlot,
              modal.path.length > 0,
            )).cloth}
            onClick={() => onCommit('cloth')}
          />
          <NativeAction
            data={{
              'data-native-dye-layer': 'trim',
              'data-native-dye-target': modal.targetItemId,
            }}
            disabled={blocked}
            label="Dye trim"
            rect={hubDyeItemLayerRects(hubInventoryVisibleSlot(
              targetSlot,
              modal.path.length > 0,
            )).trim}
            onClick={() => onCommit('trim')}
          />
        </>
      ) : null}
      <NativeAction
        data={{ 'data-native-dye-cancel': phase === 'layer' ? 'layer' : 'session' }}
        disabled={blocked}
        gameBack
        label={phase === 'layer' ? 'Cancel layer choice' : 'Cancel Fabric Dye'}
        rect={HUB_DYE_CLOTHING.cancelRect}
        onClick={onCancel}
      />
    </section>
  )
}

function InventoryBeltActions({
  audio,
  belt,
  disabled,
  onPullOff,
  rects,
}: {
  audio: GameAudioDirector
  belt: PlayerBeltComponent
  disabled: boolean
  onPullOff: (slot: number) => void
  rects: readonly NativeHudRect[]
}) {
  const pressRef = useRef<{
    readonly origin: { readonly x: number; readonly y: number }
    readonly pointerId: number
    readonly slot: number
  } | null>(null)
  const [burst, setBurst] = useState<{ readonly sequence: number; readonly slot: number } | null>(null)
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pressRef.current?.pointerId !== event.pointerId) return
    pressRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  return (
    <>
      {belt.flatMap((entry, slot) => entry === null ? [] : [(
        <NativeAction
          data={{ 'data-native-belt-slot': slot, 'data-native-belt-populated': 'true' }}
          disabled={disabled}
          key={slot}
          label={`Remove belt slot ${slot + 1}`}
          rect={[
            rects[slot]!.x,
            rects[slot]!.y,
            rects[slot]!.width,
            rects[slot]!.height,
          ]}
          onLostPointerCapture={finish}
          onPointerCancel={finish}
          onPointerDown={(event) => {
            if (event.button !== 0 || disabled) return
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            pressRef.current = {
              origin: pointerStagePosition(event),
              pointerId: event.pointerId,
              slot,
            }
          }}
          onPointerMove={(event) => {
            const press = pressRef.current
            if (!press || press.pointerId !== event.pointerId || disabled) return
            if (!nativeBeltPullOffStarted(press.origin, pointerStagePosition(event))) return
            pressRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            audio.playSound('poof')
            setBurst((current) => ({ sequence: (current?.sequence ?? 0) + 1, slot }))
            onPullOff(slot)
          }}
          onPointerUp={finish}
        />
      )])}
      {burst ? (
        <NativeBeltPullOffBurst
          className="hub-inventory-belt-pull-off-burst"
          key={`${burst.slot}:${burst.sequence}`}
          onComplete={() => setBurst((current) => (
            current?.sequence === burst.sequence && current.slot === burst.slot ? null : current
          ))}
          style={{
            left: rects[burst.slot]!.x + rects[burst.slot]!.width / 2,
            top: rects[burst.slot]!.y + rects[burst.slot]!.height / 2,
          }}
        />
      ) : null}
    </>
  )
}

function InventoryActions({
  beltRects,
  companion = false,
  economy,
  onAction,
  onBeltBind,
  onDragChange,
  onDragMove,
  onFlyby,
  onMoveSound,
  onNotice,
  onOpenDye,
  onOpenSack,
  onSelect,
  selection,
  sackPath,
  storageDropRect = null,
  transitionLocked,
}: {
  beltRects: readonly NativeHudRect[]
  companion?: boolean
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onBeltBind: (itemId: number, slot: number) => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onFlyby: (request: InventoryFlybyRequest) => void
  onMoveSound: (
    cue: 'backpack-open' | 'bad-action' | 'click',
    playbackRate: number,
  ) => void
  onNotice: (notice: HubInventoryUiNotice) => void
  onOpenDye: (dyeItemId: number) => void
  onOpenSack: (sackId: number) => void
  onSelect: (selection: HubInventorySelectionModel | null) => void
  selection: HubInventorySelectionModel | null
  sackPath: readonly number[]
  storageDropRect?: readonly [number, number, number, number] | null
  transitionLocked: boolean
}) {
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const activeRoot = inventoryItemsAtSackPath(economy.backpack, sackPath) ?? economy.backpack
  const parentSackId = sackPath.at(-1) ?? null
  const projectedBackpack = projectInventoryRootSlots(activeRoot)
    .filter(({ slot }) => (
      slot < HUB_INVENTORY_GRID.capacity - (sackPath.length > 0 ? 1 : 0)
    ))
    .map(({ item, slot }) => ({
      depth: sackPath.length,
      item,
      parentSackId,
      slot,
      visibleSlot: hubInventoryVisibleSlot(slot, sackPath.length > 0),
    }))
  const pressRef = useRef<InventoryPointerPress | null>(null)
  const equipmentClickRef = useRef<InventoryEquipmentClickPress | null>(null)
  const lastActivationRef = useRef<InventoryActivation | null>(null)
  const selectedBackpackItem = selection?.owner === 'backpack'
    ? findInventoryItem(economy.backpack, selection.id)
    : null

  const clearInventorySelection = () => {
    pressRef.current = null
    equipmentClickRef.current = null
    lastActivationRef.current = null
    onDragChange(null)
    if (selection !== null) onSelect(null)
  }

  const selectSource = (source: InventoryPointerSource, startedAtMs = performance.now()) => {
    onSelect({
      equipmentSlot: source.equipmentSlot,
      id: source.itemId,
      owner: source.owner,
      startedAtMs,
    })
  }

  const sourceIsSelected = (source: InventoryPointerSource) => selection?.id === source.itemId
    && selection.owner === source.owner
    && selection.equipmentSlot === source.equipmentSlot

  const activateSource = (source: InventoryPointerSource) => {
    if (transitionLocked) return
    if (source.owner === 'equipment') {
      if (source.equipmentSlot === 'hat') {
        onNotice(HUB_HAT_REMOVAL_MSGBOX)
        return
      }
      if (source.equipmentSlot === 'robe') {
        onNotice(HUB_ROBE_REMOVAL_MSGBOX)
        return
      }
      if (source.equipmentSlot !== null) onAction({ type: 'unequip', slot: source.equipmentSlot })
      return
    }
    const item = findInventoryItem(economy.backpack, source.itemId)
    if (!item) return
    if (item.kind === 'sack' && item.nativeTypeId === 7008) {
      onOpenSack(item.id)
      return
    }
    if (item.nativeTypeId === 7001) {
      onAction({ type: 'consume', itemId: item.id })
      return
    }
    if (item.kind === 'dye' && item.nativeTypeId === 7012 && item.nativeSubtype === 0) {
      onOpenDye(item.id)
      return
    }
    if (item.kind === 'skill-book' && item.nativeTypeId === 7012) {
      onAction({ type: 'read-skill-book', itemId: item.id })
      return
    }
    const slots = equipmentSlotsForItem(item, thirdRingUnlocked)
    const slot = slots.find((candidate) => itemAtEquipmentSlot(economy, candidate) === null) ?? slots[0]
    if (slot) onAction({ type: 'equip', itemId: item.id, slot })
  }

  const beginPointer = (source: InventoryPointerSource) => (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (transitionLocked) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const startedAtMs = performance.now()
    if (event.pointerType === 'touch') {
      const previous = lastActivationRef.current
      if (previous && sameInventorySource(previous.source, source)
        && startedAtMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs) {
        pressRef.current = null
        lastActivationRef.current = null
        onDragChange(null)
        activateSource(source)
        return
      }
      lastActivationRef.current = { atMs: startedAtMs, source }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    pressRef.current = {
      activeDrag: false,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      source,
      start: pointerStagePosition(event),
    }
    if (!sourceIsSelected(source)) selectSource(source, startedAtMs)
  }

  const beginEquipmentSlot = (
    slot: EquipmentSlot,
    source: InventoryPointerSource | null,
  ) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (transitionLocked) return
    if (event.button !== 0) return
    if (selectedBackpackItem?.equipmentType) {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      pressRef.current = null
      onDragChange(null)
      equipmentClickRef.current = {
        action: hubEquipmentClickAction(selectedBackpackItem, slot, thirdRingUnlocked),
        cancelled: false,
        pointerId: event.pointerId,
        start: pointerStagePosition(event),
      }
      return
    }
    if (source) beginPointer(source)(event)
    else {
      event.preventDefault()
      event.stopPropagation()
      clearInventorySelection()
    }
  }

  const movePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (transitionLocked) return
    const equipmentClick = equipmentClickRef.current
    if (equipmentClick?.pointerId === event.pointerId) {
      const point = pointerStagePosition(event)
      const dx = point.x - equipmentClick.start.x
      const dy = point.y - equipmentClick.start.y
      if (Math.hypot(dx, dy) >= HUB_INVENTORY_INTERACTION.dragThresholdPixels) {
        equipmentClick.cancelled = true
      }
      return
    }
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    const point = pointerStagePosition(event)
    if (!press.activeDrag) {
      const dx = point.x - press.start.x
      const dy = point.y - press.start.y
      if (Math.hypot(dx, dy) < HUB_INVENTORY_INTERACTION.dragThresholdPixels) return
      press.activeDrag = true
      onDragChange({
        equipmentSlot: press.source.equipmentSlot,
        itemId: press.source.itemId,
        owner: press.source.owner,
        pointer: point,
      })
    }
    onDragMove(point)
  }

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (transitionLocked) return
    const equipmentClick = equipmentClickRef.current
    if (equipmentClick?.pointerId === event.pointerId) {
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      equipmentClickRef.current = null
      lastActivationRef.current = null
      if (!equipmentClick.cancelled && equipmentClick.action) onAction(equipmentClick.action)
      return
    }
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointerStagePosition(event)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pressRef.current = null
    if (press.activeDrag) {
      if (press.pointerType === 'touch') lastActivationRef.current = null
      onDragChange(null)
      selectSource(press.source, performance.now() - HUB_INVENTORY_INTERACTION.itemInfoDelayMs)
      dropInventorySource(
        press.source,
        point,
        economy,
        thirdRingUnlocked,
        onAction,
        onBeltBind,
        onFlyby,
        onMoveSound,
        onNotice,
        companion,
        sackPath,
        beltRects,
        storageDropRect,
      )
      return
    }
    if (press.pointerType === 'touch') return
    const nowMs = performance.now()
    const previous = lastActivationRef.current
    if (previous && sameInventorySource(previous.source, press.source)
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs) {
      lastActivationRef.current = null
      activateSource(press.source)
    } else lastActivationRef.current = { atMs: nowMs, source: press.source }
  }

  const cancelPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (equipmentClickRef.current?.pointerId === event.pointerId) {
      equipmentClickRef.current = null
      return
    }
    const press = pressRef.current
    if (press?.pointerId !== event.pointerId) return
    if (press.pointerType === 'touch' && press.activeDrag) lastActivationRef.current = null
    pressRef.current = null
    onDragChange(null)
  }

  const keyboardSelect = (source: InventoryPointerSource) => (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (transitionLocked) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    const nowMs = performance.now()
    const previous = lastActivationRef.current
    if (!sourceIsSelected(source)) selectSource(source, nowMs)
    if (previous && sameInventorySource(previous.source, source)
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs) {
      lastActivationRef.current = null
      activateSource(source)
    } else lastActivationRef.current = { atMs: nowMs, source }
  }

  const keyboardEquipmentSlot = (
    slot: EquipmentSlot,
    source: InventoryPointerSource | null,
  ) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (transitionLocked) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (selectedBackpackItem?.equipmentType) {
      event.preventDefault()
      lastActivationRef.current = null
      const action = hubEquipmentClickAction(selectedBackpackItem, slot, thirdRingUnlocked)
      if (action) onAction(action)
      return
    }
    if (source) keyboardSelect(source)(event)
    else {
      event.preventDefault()
      clearInventorySelection()
    }
  }

  return (
    <>
      <NativeAction
        data={{ 'data-inventory-empty-space': 'true' }}
        label="Deselect inventory item"
        disabled={transitionLocked}
        rect={[0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height]}
        tabIndex={-1}
        onClick={clearInventorySelection}
      />
      <section aria-label="Backpack">
        {sackPath.length > 0 ? (
          <NativeAction
            data={{ 'data-inventory-parent-holder': 'true' }}
            disabled={transitionLocked}
            label="Move selected item to parent inventory"
            rect={(() => {
              const position = hubInventorySlotPosition(HUB_INVENTORY_PARENT_HOLDER.visibleSlot)
              return [
                position.x,
                position.y,
                HUB_INVENTORY_GRID.cellSize,
                HUB_INVENTORY_GRID.cellSize,
              ] as const
            })()}
            onClick={() => {
              if (!selectedBackpackItem) {
                onMoveSound('bad-action', 1)
                return
              }
              onMoveSound('backpack-open', 1.25)
              onAction({
                destinationSackId: sackPath.length > 1 ? sackPath[sackPath.length - 2]! : null,
                destinationSlot: null,
                itemId: selectedBackpackItem.id,
                type: 'move-inventory-item',
              })
            }}
          />
        ) : null}
        {projectedBackpack.map(({ depth, item, parentSackId, slot, visibleSlot }) => {
          const position = hubInventorySlotPosition(visibleSlot)
          const source: InventoryPointerSource = {
            equipmentSlot: null,
            itemId: item.id,
            owner: 'backpack',
          }
          return (
            <NativeAction
              key={item.id}
              data={{
                'data-inventory-item-id': item.id,
                'data-inventory-depth': depth,
                'data-inventory-owner': 'backpack',
                'data-inventory-slot': slot,
                'data-parent-sack-id': parentSackId ?? '',
                'data-selected': selection?.id === item.id && selection.owner === 'backpack' ? 'true' : 'false',
              }}
              label={`${item.name}, quantity ${item.quantity}`}
              disabled={transitionLocked}
              rect={[position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize]}
              onKeyDown={keyboardSelect(source)}
              onPointerCancel={cancelPointer}
              onPointerDown={beginPointer(source)}
              onPointerMove={movePointer}
              onPointerUp={finishPointer}
            />
          )
        })}
      </section>
      {EQUIPMENT_SLOT_ORDER.map((slot) => {
        const item = itemAtEquipmentSlot(economy, slot)
        const locked = slot === 'ring-2' && !thirdRingUnlocked
        if (locked) return null
        const source: InventoryPointerSource | null = item ? {
          equipmentSlot: slot,
          itemId: item.id,
          owner: 'equipment',
        } : null
        return hubInventoryEquipmentSlotRects(slot, companion).map((rect, aliasIndex) => (
          <NativeAction
            key={`${slot}-${aliasIndex}`}
            data={{
              'data-equipment-alias': aliasIndex,
              'data-equipment-slot': slot,
              'data-inventory-item-id': item?.id ?? '',
              'data-inventory-owner': 'equipment',
              'data-selected': item && selection?.id === item.id
                && selection.owner === 'equipment' && selection.equipmentSlot === slot
                ? 'true'
                : 'false',
            }}
            label={`${EQUIPMENT_SLOT_LABELS[slot]}${item ? `, ${item.name}` : ', empty'}`}
            disabled={transitionLocked}
            rect={rect}
            onKeyDown={keyboardEquipmentSlot(slot, source)}
            onPointerCancel={cancelPointer}
            onPointerDown={beginEquipmentSlot(slot, source)}
            onPointerMove={movePointer}
            onPointerUp={finishPointer}
          />
        ))
      })}
    </>
  )
}

interface InventoryPointerSource {
  readonly equipmentSlot: EquipmentSlot | null
  readonly itemId: number
  readonly owner: 'backpack' | 'equipment'
}

interface InventoryPointerPress {
  activeDrag: boolean
  readonly pointerId: number
  readonly pointerType: string
  readonly source: InventoryPointerSource
  readonly start: { readonly x: number; readonly y: number }
}

interface InventoryActivation {
  readonly atMs: number
  readonly source: InventoryPointerSource
}

interface InventoryEquipmentClickPress {
  readonly action: Extract<HubInventoryAction, { readonly type: 'equip' }> | null
  cancelled: boolean
  readonly pointerId: number
  readonly start: { readonly x: number; readonly y: number }
}

function pointerStagePosition(
  event: ReactPointerEvent<HTMLElement>,
): { readonly x: number; readonly y: number } {
  const stage = event.currentTarget.closest('.hub-native-ui-stage')
  if (!(stage instanceof HTMLElement)) return { x: event.clientX, y: event.clientY }
  const rect = stage.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * HUB_NATIVE_UI_SIZE.width / rect.width,
    y: (event.clientY - rect.top) * HUB_NATIVE_UI_SIZE.height / rect.height,
  }
}

function sameInventorySource(left: InventoryPointerSource, right: InventoryPointerSource): boolean {
  return left.itemId === right.itemId
    && left.owner === right.owner
    && left.equipmentSlot === right.equipmentSlot
}

function pointInRect(
  point: { readonly x: number; readonly y: number },
  [left, top, width, height]: readonly [number, number, number, number],
): boolean {
  return point.x >= left && point.x <= left + width
    && point.y >= top && point.y <= top + height
}

function inventoryVisibleSlotAtPoint(
  point: { readonly x: number; readonly y: number },
): number | null {
  for (let slot = 0; slot < HUB_INVENTORY_GRID.capacity; slot += 1) {
    const position = hubInventorySlotPosition(slot)
    if (pointInRect(point, [
      position.x,
      position.y,
      HUB_INVENTORY_GRID.cellSize,
      HUB_INVENTORY_GRID.cellSize,
    ])) return slot
  }
  return null
}

function dropInventorySource(
  source: InventoryPointerSource,
  point: { readonly x: number; readonly y: number },
  economy: ProtocolPlayerEconomy,
  thirdRingUnlocked: boolean,
  onAction: (action: HubInventoryAction) => void,
  onBeltBind: (itemId: number, slot: number) => void,
  onFlyby: (request: InventoryFlybyRequest) => void,
  onMoveSound: (
    cue: 'backpack-open' | 'bad-action' | 'click',
    playbackRate: number,
  ) => void,
  onNotice: (notice: HubInventoryUiNotice) => void,
  companion: boolean,
  sackPath: readonly number[],
  beltRects: readonly NativeHudRect[],
  storageDropRect: readonly [number, number, number, number] | null,
): void {
  if (source.owner === 'backpack') {
    const projected = projectInventoryItems(economy.backpack)
    const sourceEntry = projected.find(({ item }) => item.id === source.itemId)
    const activeRoot = inventoryItemsAtSackPath(economy.backpack, sackPath) ?? economy.backpack
    const hasParentRoot = sackPath.length > 0
    const visibleItems = projectInventoryRootSlots(activeRoot).filter(({ slot }) => (
      slot < HUB_INVENTORY_GRID.capacity - (hasParentRoot ? 1 : 0)
    ))
    if (!sourceEntry) return
    const item = sourceEntry.item
    const sourceSlot = hubInventoryVisibleSlot(sourceEntry.slot, hasParentRoot)
    const sourcePosition = hubInventorySlotPosition(sourceSlot)
    const sourceCenter = {
      x: sourcePosition.x + HUB_INVENTORY_GRID.cellSize / 2,
      y: sourcePosition.y + HUB_INVENTORY_GRID.cellSize / 2,
    }
    const restore = () => {
      onMoveSound('bad-action', 1)
      onFlyby({ action: null, lanes: [{ from: point, item, to: sourceCenter }] })
    }
    if (pointInRect(point, HUB_UNFORGE_TARGET.rect)) {
      if (!nativeInventoryItemCanUnforge(item)) {
        restore()
        return
      }
      if (item.nativeTypeId === 7008) {
        if ((item.contents?.length ?? 0) === 0) onAction({ type: 'unforge', itemId: item.id })
        else restore()
        return
      }
      onNotice({ ...HUB_UNFORGE_CONFIRMATION_NOTICE, unforgeItemId: item.id })
      return
    }
    if (nativeInventoryItemCanBindToBelt(item)) {
      const beltSlot = nativeSkillQuickbarDropSlot(point, beltRects)
      if (beltSlot !== null) {
        onBeltBind(item.id, beltSlot)
        return
      }
    }
    if (storageDropRect && pointInRect(point, storageDropRect)) {
      onAction({ type: 'transfer', direction: 'to-storage', gesture: 'drag', itemId: item.id })
      return
    }
    const slot = equipmentSlotsForItem(item, thirdRingUnlocked).find((candidate) => (
      hubInventoryEquipmentSlotRects(candidate, companion).some((rect) => pointInRect(point, rect))
    ))
    if (slot) {
      onAction({ type: 'equip', itemId: item.id, slot })
      return
    }
    const visibleSlot = inventoryVisibleSlotAtPoint(point)
    if (hasParentRoot && visibleSlot === 0) {
      onMoveSound('backpack-open', 1.25)
      onAction({
        type: 'move-inventory-item',
        destinationSackId: sackPath.length > 1 ? sackPath[sackPath.length - 2]! : null,
        destinationSlot: null,
        itemId: item.id,
      })
      return
    }
    const destinationSlot = visibleSlot === null
      ? null
      : hubInventoryRootSlot(visibleSlot, hasParentRoot)
    const destinationSack = destinationSlot === null
      ? null
      : visibleItems.find(({ item: candidate, slot }) => (
          slot === destinationSlot && candidate.nativeTypeId === 7008
        ))?.item ?? null
    if (destinationSack) {
      onMoveSound('backpack-open', 1.25)
      onAction({
        type: 'move-inventory-item',
        destinationSackId: destinationSack.id,
        destinationSlot: null,
        itemId: item.id,
      })
      return
    }
    if (destinationSlot !== null) {
      const action: InventoryMoveAction = {
        type: 'move-inventory-item',
        destinationSackId: sackPath.at(-1) ?? null,
        destinationSlot,
        itemId: item.id,
      }
      if (sourceEntry.parentSackId === action.destinationSackId
        && destinationSlot === sourceEntry.slot) {
        restore()
        return
      }
      const resident = visibleItems.find(({ slot }) => slot === destinationSlot)?.item ?? null
      if (!resident) {
        onAction(action)
        return
      }
      onMoveSound('click', 1.75)
      if (inventoryItemsShareStack(resident, item)) {
        onAction(action)
        return
      }
      const destinationPosition = hubInventorySlotPosition(
        hubInventoryVisibleSlot(destinationSlot, hasParentRoot),
      )
      const destinationCenter = {
        x: destinationPosition.x + HUB_INVENTORY_GRID.cellSize / 2,
        y: destinationPosition.y + HUB_INVENTORY_GRID.cellSize / 2,
      }
      onFlyby({
        action,
        lanes: [
          { from: sourceCenter, item, to: destinationCenter },
          { from: destinationCenter, item: resident, to: sourceCenter },
        ],
      })
      return
    }
    restore()
    return
  }
  if (source.equipmentSlot !== null) {
    const item = itemAtEquipmentSlot(economy, source.equipmentSlot)
    if (item && nativeInventoryItemCanBindToBelt(item)) {
      const beltSlot = nativeSkillQuickbarDropSlot(point, beltRects)
      if (beltSlot !== null) {
        onBeltBind(item.id, beltSlot)
        return
      }
    }
  }
  if (source.equipmentSlot === null || !pointInRect(point, [0, 490, 1600, 310])) return
  if (source.equipmentSlot === 'hat') {
    onNotice(HUB_HAT_REMOVAL_MSGBOX)
    return
  }
  if (source.equipmentSlot === 'robe') {
    onNotice(HUB_ROBE_REMOVAL_MSGBOX)
    return
  }
  onAction({ type: 'unequip', slot: source.equipmentSlot })
}

function ShopAction({
  data,
  dowsing = false,
  index,
  label,
  onBlur,
  onClick,
  onFocus,
  onPointerEnter,
  onPointerLeave,
  price,
  selected,
}: {
  data?: Record<string, number | string>
  dowsing?: boolean
  index: number
  label: string
  onBlur: () => void
  onClick: () => void
  onFocus: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  price: number
  selected: boolean
}) {
  const position = dowsing ? hubDowsingSlotPosition(index) : hubShopSlotPosition(index)
  return (
    <NativeAction
      data={{ ...data, 'data-selected': selected ? 'true' : 'false' }}
      label={label}
      rect={[
        position.x,
        position.y,
        dowsing ? HUB_DOWSING_GRID.cellSize : HUB_SHOP_GRID.cellSize,
        dowsing ? HUB_DOWSING_GRID.cellSize : HUB_SHOP_GRID.cellSize,
      ]}
      onBlur={onBlur}
      onClick={onClick}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') event.preventDefault()
      }}
    >
      <span className="hub-native-ui-semantic hub-trader-price">{price.toLocaleString()}</span>
    </NativeAction>
  )
}

function EmptyStoreGridActions({
  dowsing = false,
  fromIndex,
  occupiedSlots,
  onClear,
}: {
  dowsing?: boolean
  fromIndex: number
  occupiedSlots?: readonly number[]
  onClear: () => void
}) {
  const capacity = dowsing
    ? HUB_DOWSING_GRID.retainedCapacity
    : HUB_SHOP_GRID.retainedCapacity
  const occupied = new Set(occupiedSlots ?? [])
  const indices = occupiedSlots === undefined
    ? Array.from({ length: Math.max(0, capacity - fromIndex) }, (_, offset) => fromIndex + offset)
    : Array.from({ length: capacity }, (_, index) => index).filter((index) => !occupied.has(index))
  return indices.map((index) => {
    const position = dowsing ? hubDowsingSlotPosition(index) : hubShopSlotPosition(index)
    return (
      <NativeAction
        key={`empty-store-${index}`}
        data={{ 'data-store-empty-slot': index }}
        label="Empty store slot"
        rect={[
          position.x,
          position.y,
          dowsing ? HUB_DOWSING_GRID.cellSize : HUB_SHOP_GRID.cellSize,
          dowsing ? HUB_DOWSING_GRID.cellSize : HUB_SHOP_GRID.cellSize,
        ]}
        tabIndex={-1}
        onClick={onClear}
      />
    )
  })
}

function activateSelection(
  current: HubServiceSelection | null,
  next: HubServiceSelection,
  select: (selection: HubServiceSelection | null) => void,
  activate: () => void,
): void {
  if (current?.id === next.id && current.owner === next.owner) activate()
  else select(next)
}

function NativeAction({
  children,
  data,
  disabled = false,
  gameBack = false,
  label,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  onLostPointerCapture,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  onPressedChange,
  onWheel,
  rect,
  tabIndex,
}: {
  children?: ReactNode
  data?: Record<string, number | string>
  disabled?: boolean
  gameBack?: boolean
  label: string
  onBlur?: () => void
  onClick?: () => void
  onFocus?: () => void
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onLostPointerCapture?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPressedChange?: (pressed: boolean) => void
  onWheel?: (event: ReactWheelEvent<HTMLButtonElement>) => void
  rect: readonly [number, number, number, number]
  tabIndex?: number
}) {
  return (
    <button
      type="button"
      className="hub-native-ui-action"
      aria-label={label}
      data-game-back={gameBack || undefined}
      disabled={disabled}
      style={rectStyle(rect)}
      tabIndex={tabIndex}
      onBlur={() => {
        onPressedChange?.(false)
        onBlur?.()
      }}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={(event) => {
        if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) onPressedChange?.(true)
        onKeyDown?.(event)
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onPressedChange?.(false)
      }}
      onLostPointerCapture={onLostPointerCapture}
      onPointerCancel={(event) => {
        onPressedChange?.(false)
        onPointerCancel?.(event)
      }}
      onPointerDown={(event) => {
        if (event.button === 0) onPressedChange?.(true)
        onPointerDown?.(event)
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={() => {
        onPressedChange?.(false)
        onPointerLeave?.()
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        onPressedChange?.(false)
        onPointerUp?.(event)
      }}
      onWheel={onWheel}
      {...data}
    >
      <span className="hub-native-ui-semantic">{label}</span>
      {children}
    </button>
  )
}

function rectStyle([left, top, width, height]: readonly [number, number, number, number]): CSSProperties {
  return { height, left, top, width }
}

function nativeUiActionRect(bounds: Readonly<{
  height: number
  left: number
  top: number
  width: number
}>): readonly [number, number, number, number] {
  return [bounds.left, bounds.top, bounds.width, bounds.height]
}

function itemAtEquipmentSlot(economy: ProtocolPlayerEconomy, slot: EquipmentSlot): HubInventoryItem | null {
  switch (slot) {
    case 'amulet': return economy.equipment.amulet
    case 'hat': return economy.equipment.hat
    case 'ring-0': return economy.equipment.rings[0]
    case 'ring-1': return economy.equipment.rings[1]
    case 'ring-2': return economy.equipment.rings[2]
    case 'robe': return economy.equipment.robe
    case 'weapon': return economy.equipment.weapon
  }
}

function dowsingItems(economy: ProtocolPlayerEconomy): readonly HubShopItem[] {
  return economy.dowsingOffers.map((offer) => {
    const recipe = DOWSING_EQUIPMENT_RECIPES[offer.recipeIndex]!
    return {
      equipmentType: recipe.type,
      iconRecords: recipe.iconRecords,
      id: offer.id,
      kind: 'equipment',
      name: recipe.name,
      nativeSubtype: null,
      nativeTypeId: recipe.nativeTypeId,
      price: offer.price,
      quantity: 1,
      rarity: recipe.rarity,
      recipeIndex: recipe.sourceIndex,
    }
  })
}

function serviceInspectionTooltipText(
  inspection: HubServiceInspectionModel,
  economy: ProtocolPlayerEconomy,
  progression: ProtocolPlayerProgression,
  trader: HubTraderId,
): string | null {
  if (inspection.kind === 'owned-perk') {
    if (
      economy.ownedPerkSelectors[inspection.index] !== inspection.selector
    ) return null
    return tooltipSemanticText(hubHagathaTooltipLines({
      cheatDeathCharges: inspection.selector === 7 ? 1 : null,
      firstMixed: true,
      price: null,
      selector: inspection.selector,
    }))
  }
  if (trader === 'hagatha') {
    const offer = economy.hagathaOffers.find(({ selector }) => selector === inspection.id)
    if (!offer || inspection.owner !== null) return null
    return tooltipSemanticText(hubHagathaTooltipLines({
      bundleSelectors: offer.members,
      cheatDeathCharges: null,
      firstMixed: offer.price === offer.basePrice,
      price: offer.price,
      selector: offer.selector,
    }))
  }
  const item = trader === 'luthacus'
    ? findInventoryItem(economy.storage, inspection.id)
    : trader === 'fomentius'
      ? economy.fomentiusStock.find(({ id }) => id === inspection.id)
      : dowsingItems(economy).find(({ id }) => id === inspection.id)
  if (!item) return null
  return tooltipSemanticText(hubItemTooltipLines(item, {
    creativityRank: progression.learnedSkills.find(
      ([skillId]) => skillId === NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
    )?.[1] ?? 0,
    playerLevel: progression.level,
    price: trader === 'luthacus' ? null : hubShopItemPrice(item),
  }))
}

function hubShopItemPrice(item: HubInventoryItem | HubShopItem): number | null {
  return 'price' in item && typeof item.price === 'number' ? item.price : null
}

function tooltipSemanticText(lines: readonly { readonly text: string }[]): string {
  return lines.map(({ text }) => text.trim()).filter(Boolean).join(' ')
}
