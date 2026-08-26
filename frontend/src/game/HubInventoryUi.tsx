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
} from 'react'
import { createPortal } from 'react-dom'

import nativeAssetsJson from '../assets/game/native-ui-assets.json' with { type: 'json' }
import {
  DOWSING_EQUIPMENT_RECIPES,
  HAGATHA_PERKS,
  MAX_NATIVE_DYE_SELECTIONS,
  findInventoryItem,
  nativeDyeMixedTint,
  inventoryDyeableClothingItems,
  nativeInventoryItemCanUnforge,
  nativeUnforgeOutcomeText,
  projectInventoryItems,
  type EquipmentSlot,
  type HubInventoryAction,
  type HubInventoryItem,
  type HubShopItem,
  type HubTraderId,
  type NativeUnforgeOutcome,
} from './core-kernels/hub-economy.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import {
  NATIVE_HUB_NPC_CATALOG,
  NATIVE_SELECTOR_ACCEPT_TICKS,
  nativeBoastFailureText,
} from './core-kernels/native-hub-npc.ts'
import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'
import type { HubMemorialState } from './core-kernels/hub-memorial.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudModalSlideLayout,
} from './native-hud-layout.ts'
import {
  initialNativeModalSlideProgressSnapshot,
  nativeModalSlideProgressSnapshot,
  setNativeModalSlideProgress,
  subscribeNativeModalSlideProgress,
} from './native-modal-slide-progress.ts'
import ContextualInteractButton from './ContextualInteractButton.tsx'
import {
  HUB_INTERACTION_DIALOGUES,
  equipmentSlotsForItem,
  hubEquipmentClickAction,
  hubInteractionPromptLabel,
  hubInteractionDialogue,
  hubInteractionWithinRange,
  hubMemorialEulogyIndex,
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
  hubNpcSelectorContent,
  hubNpcSelectorResponse,
  hubNpcSelectorRows,
  hubNpcSelectorTitle,
  type HubNpcChatChoice,
  type HubNpcChatContent,
  type HubNpcSelectorRow,
} from './hub-npc-dialogue.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from './protocol/game-state.ts'
import type { GameModAsset } from './protocol/game-protocol.ts'
import {
  createHubInventoryRenderer,
  type HubInventoryDragModel,
  type HubInventoryDyeModalModel,
  type HubInventoryPressedControl,
  type HubInventoryRenderer,
  type HubInventoryRendererModel,
  type HubInventoryRendererNotice,
  type HubInventorySelectionModel,
  type HubServiceInspectionModel,
} from './renderer/hub-inventory-renderer.ts'
import {
  HUB_CHAT_PANEL,
  HUB_DOWSING_GRID,
  HUB_DYE_CLOTHING,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_HAT_REMOVAL_MSGBOX,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_INTERACTION,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_TIMING,
  HUB_NPC_SELECTOR,
  HUB_ROBE_REMOVAL_MSGBOX,
  HUB_UNFORGE_CONFIRMATION,
  HUB_UNFORGE_RESULT,
  HUB_UNFORGE_TARGET,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  hubNativeUiReveal,
  hubDowsingSlotPosition,
  hubDyeItemLayerRects,
  hubDyeSwatchRect,
  hubHagathaTooltipLines,
  hubInventoryEquipmentSlotRects,
  hubItemTooltipLines,
  hubInventorySlotPosition,
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

interface HubInventoryUiNotice extends HubInventoryRendererNotice {
  readonly unforgeItemId?: number
}

interface HubNpcChatPresentation {
  readonly acceleratedAtMs: number | null
  readonly content: HubNpcChatContent
  readonly phaseStartedAtMs: number
  readonly selectorOffset: number
}

interface PendingHubNpcSelection {
  readonly action: 'buy-teacher-spell' | 'read-librarian-book' | 'select-boast'
  readonly id: number
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

interface HubInventoryUiProps {
  audio: GameAudioDirector
  config: PlayerCharacterConfig
  disabled: boolean
  economy: ProtocolPlayerEconomy
  inventoryKeyCode: string
  menuKeyCode: string
  memorial?: HubMemorialState | null
  nativeUiStageStyle: CSSProperties
  onAction: (action: HubInventoryAction) => void
  onBlockingOverlayChange?: (open: boolean) => void
  modAssets: readonly GameModAsset[]
  onSurfaceChange: (surface: HubUiSurface) => void
  overlayRoot: RefObject<HTMLDivElement | null>
  playerPosition: Vector2
  progression: ProtocolPlayerProgression
  region: HubRegionId
  surface: HubUiSurface
  skorchaDismissalIndex?: number
  skorchaPosition?: Vector2 | null
  transitionActive: boolean
  interactionsEnabled?: boolean
  storyOffice?: boolean
}

export default function HubInventoryUi({
  audio,
  config,
  disabled,
  economy,
  inventoryKeyCode,
  menuKeyCode,
  memorial = null,
  nativeUiStageStyle,
  onAction,
  onBlockingOverlayChange,
  modAssets,
  onSurfaceChange,
  overlayRoot,
  playerPosition,
  progression,
  region,
  surface,
  skorchaDismissalIndex = 0,
  skorchaPosition = null,
  transitionActive,
  interactionsEnabled = true,
  storyOffice = false,
}: HubInventoryUiProps) {
  const failureSequenceRef = useRef(economy.npc.boast.failureSequence)
  const [npcNotebox, setNpcNotebox] = useState<string | null>(null)
  const nearestInteraction = useMemo(
    () => disabled || transitionActive || !interactionsEnabled
      ? null
      : nearestHubInteraction(region, playerPosition, { skorchaPosition, storyOffice }),
    [
      disabled,
      interactionsEnabled,
      playerPosition,
      region,
      skorchaPosition,
      storyOffice,
      transitionActive,
    ],
  )

  const closeSurface = useCallback(() => {
    if (surface?.kind === 'service' && surface.trader === 'shlorio'
      && economy.dowsingOffers.length > 0) {
      onAction({ type: 'close-dowsing' })
    }
    onSurfaceChange(null)
  }, [economy.dowsingOffers.length, onAction, onSurfaceChange, surface])

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
      if (event.repeat) return
      if (surface && (
        event.code === menuKeyCode
        || (surface.kind === 'inventory' && event.code === inventoryKeyCode)
      )) {
        if (surface.kind === 'dialogue' && event.code === menuKeyCode) return
        event.preventDefault()
        event.stopImmediatePropagation()
        if (surface.kind !== 'dialogue') audio.playSound('open-panel')
        closeSurface()
        return
      }
      if (!surface && !disabled && !transitionActive && event.code === inventoryKeyCode) {
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
    audio,
    closeSurface,
    disabled,
    inventoryKeyCode,
    menuKeyCode,
    nearestInteraction,
    openWorldDialogue,
    surface,
    transitionActive,
  ])

  useEffect(() => {
    const sequence = economy.npc.boast.failureSequence
    if (sequence <= failureSequenceRef.current) return
    failureSequenceRef.current = sequence
    setNpcNotebox(nativeBoastFailureText(economy.npc.boast))
  }, [economy.npc.boast])

  useEffect(() => {
    onBlockingOverlayChange?.(npcNotebox !== null)
    return () => onBlockingOverlayChange?.(false)
  }, [npcNotebox, onBlockingOverlayChange])

  const prompt = !surface && nearestInteraction ? (
      <ContextualInteractButton
        label={hubInteractionPromptLabel(nearestInteraction)}
        target={`hub:${nearestInteraction}`}
        onInteract={() => openWorldDialogue(nearestInteraction)}
      />
    ) : null

  const overlay = surface ? (
    <NativeHubSurface
      key={surface.kind === 'dialogue'
        ? `${surface.kind}-${surface.interaction}`
        : `${surface.kind}-${'trader' in surface ? surface.trader : 'player'}`}
      audio={audio}
      config={config}
      economy={economy}
      modAssets={modAssets}
      menuKeyCode={menuKeyCode}
      memorial={memorial}
      onAction={onAction}
      onClose={closeSurface}
      onNotebox={setNpcNotebox}
      onSurfaceChange={onSurfaceChange}
      progression={progression}
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
        <NativeNpcNotebox
          style={nativeUiStageStyle}
          text={npcNotebox}
          onClose={() => setNpcNotebox(null)}
        />,
        overlayRoot.current,
      ) : null}
    </>
  )
}

function NativeHubSurface({
  audio,
  config,
  economy,
  modAssets,
  menuKeyCode,
  memorial,
  onAction,
  onClose,
  onNotebox,
  onSurfaceChange,
  progression,
  skorchaDismissalIndex,
  style,
  surface,
  storyOffice,
}: {
  audio: GameAudioDirector
  config: PlayerCharacterConfig
  economy: ProtocolPlayerEconomy
  modAssets: readonly GameModAsset[]
  menuKeyCode: string
  memorial: HubMemorialState | null
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onNotebox: (text: string) => void
  onSurfaceChange: (surface: HubUiSurface) => void
  progression: ProtocolPlayerProgression
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
        )
      : { kind: 'choices' },
    phaseStartedAtMs: performance.now(),
    selectorOffset: 0,
  }))
  const [pendingNpcSelection, setPendingNpcSelection] =
    useState<PendingHubNpcSelection | null>(null)
  const [serviceSelection, setServiceSelection] = useState<HubServiceSelection | null>(null)
  const [serviceHoverInspection, setServiceHoverInspection] = useState<HubServiceInspectionModel | null>(null)
  const [serviceFocusInspection, setServiceFocusInspection] = useState<HubServiceInspectionModel | null>(null)
  const [inventorySelection, setInventorySelection] = useState<HubInventorySelectionModel | null>(null)
  const [inventoryDrag, setInventoryDrag] = useState<HubInventoryDragModel | null>(null)
  const [dyeModal, setDyeModal] = useState<HubInventoryDyeModalModel | null>(null)
  const feedbackSequenceRef = useRef(economy.actionFeedback?.sequence ?? 0)
  const modalSlides = useSyncExternalStore(
    subscribeNativeModalSlideProgress,
    nativeModalSlideProgressSnapshot,
    initialNativeModalSlideProgressSnapshot,
  )
  const inventoryResumeControl = nativeHudModalSlideLayout(
    NATIVE_HUD_BACKBUFFER.width,
    NATIVE_HUD_BACKBUFFER.height,
    modalSlides.inventory,
  ).backpack
  const inventoryResumeRect = [
    inventoryResumeControl.x,
    inventoryResumeControl.y,
    inventoryResumeControl.width,
    inventoryResumeControl.height,
  ] as const

  useLayoutEffect(() => {
    if (surface.kind !== 'inventory') return
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
    if (!feedback.accepted) {
      audio.playSound('bad-action')
      return
    }
    if (feedback.action === 'buy-fomentius' || feedback.action === 'buy-hagatha') {
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
  }, [audio, economy.actionFeedback, onClose, pendingNpcSelection])

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
    setChat({
      acceleratedAtMs: null,
      content,
      phaseStartedAtMs: performance.now(),
      selectorOffset: 0,
    })
  }, [])

  const selectorRows = useMemo((): readonly HubNpcSelectorRow[] => (
    chat.content.kind === 'selector'
      ? hubNpcSelectorRows(chat.content.selector, economy.npc, progression)
      : []
  ), [chat.content, economy.npc, progression])

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
    if (chat.content.key.startsWith('ANNAL_') && economy.npc.boast.selected !== null) {
      onNotebox(NATIVE_HUB_NPC_CATALOG.boastInstruction)
    }
    onClose()
  }, [
    beginChatContent,
    chat.content,
    economy.npc.boast.selected,
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
  }, [audio, beginChatContent, chat.content, dismissOrCloseChat, menuKeyCode, surface.kind])

  const model = useMemo((): HubInventoryRendererModel => {
    if (surface.kind === 'inventory') return {
      config,
      dragging: inventoryDrag,
      dyeModal,
      economy,
      kind: 'inventory',
      notice,
      pressedControl,
      progression,
      selection: inventorySelection,
    }
    if (surface.kind === 'dialogue') return {
      acceleratedAtMs: chat.acceleratedAtMs,
      content: chat.content,
      interaction: surface.interaction,
      kind: 'dialogue',
      phaseStartedAtMs: chat.phaseStartedAtMs,
      selectedSelectorId: pendingNpcSelection?.id ?? null,
      selectorOffset: chat.selectorOffset,
      selectorRows,
      storyOffice,
    }
    return {
      config,
      dragging: inventoryDrag,
      dyeModal,
      economy,
      inspection: serviceHoverInspection ?? serviceFocusInspection,
      inventorySelection,
      kind: 'service',
      notice,
      pressedControl,
      progression,
      selectedItemId: serviceSelection?.id ?? null,
      selectedOwner: serviceSelection?.owner ?? null,
      trader: surface.trader,
    }
  }, [
    chat,
    config,
    economy,
    dyeModal,
    inventoryDrag,
    inventorySelection,
    notice,
    pendingNpcSelection,
    pressedControl,
    progression,
    serviceFocusInspection,
    serviceHoverInspection,
    serviceSelection,
    selectorRows,
    storyOffice,
    surface,
  ])

  useLayoutEffect(() => {
    modelRef.current = model
    rendererRef.current?.setModel(model)
  }, [model])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let renderer: HubInventoryRenderer | undefined
    void createHubInventoryRenderer(modAssets).then((created) => {
      if (disposed) {
        created.destroy()
        return
      }
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
      const step = surface.kind === 'dialogue'
        ? HUB_NATIVE_UI_TIMING.chatRevealPerTick
        : HUB_NATIVE_UI_TIMING.inventoryRevealPerTick
      const reveal = hubNativeUiReveal(nowMs - revealStartedAtRef.current, step)
      if (surface.kind === 'inventory') setNativeModalSlideProgress('inventory', reveal)
      const frame = renderer.render(nowMs, reveal)
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
      renderer?.destroy()
      host.replaceChildren()
    }
  }, [modAssets, surface.kind])

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
        }
      } else {
        const equipped = inventorySelection.equipmentSlot === null
          ? null
          : itemAtEquipmentSlot(economy, inventorySelection.equipmentSlot)
        if (equipped?.id !== inventorySelection.id) {
          if (findInventoryItem(economy.backpack, inventorySelection.id)) {
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
  }, [economy, inventorySelection, serviceSelection, surface])

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
  const semanticTooltip = surface.kind === 'service' && activeServiceInspection
    ? serviceInspectionTooltipText(
        activeServiceInspection,
        economy,
        progression,
        surface.trader,
      )
    : null

  return (
    <div className="hub-native-ui-overlay" data-surface-kind={surface.kind}>
      <section
        className="hub-native-ui-stage"
        style={style}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-native-ui-schema={nativeAssetsJson.schema}
        data-source-executable={nativeAssetsJson.sourceExecutableSha256}
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
                onPressedChange={notice.variant === undefined
                  ? (pressed) => setPressedControl(pressed ? 'message-primary' : null)
                  : undefined}
              />
              {notice.variant === 'unforge-confirmation' ? (
                <NativeAction
                  gameBack
                  label={notice.secondaryActionLabel ?? 'CANCEL'}
                  rect={HUB_UNFORGE_CONFIRMATION.secondaryButtonRect}
                  onClick={() => click(() => setNotice(null))}
                />
              ) : null}
            </>
          ) : surface.kind === 'dialogue' ? (
            <DialogueActions
              chat={chat}
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
              }))}
              onSelectorDone={() => click(() => beginChatContent({ kind: 'choices' }))}
            />
          ) : surface.kind === 'service' ? (
            <ServiceActions
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
                  && action.type !== 'unforge') audio.playSound('click')
                onAction(action)
              }}
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
              onOpenDye={openDye}
              onPressedControl={setPressedControl}
              onSelect={setServiceSelection}
            />
          ) : (
            <InventoryActions
              economy={economy}
              selection={inventorySelection}
              onAction={(action) => {
                if (action.type !== 'consume' && action.type !== 'unforge') audio.playSound('click')
                onAction(action)
              }}
              onDragChange={setInventoryDrag}
              onDragMove={(point) => rendererRef.current?.moveDrag(point)}
              onNotice={setNotice}
              onOpenDye={openDye}
              onSelect={(next) => {
                audio.playSound('click')
                setInventorySelection(next)
              }}
            />
          )}
          {semanticTooltip ? (
            <span className="hub-native-ui-semantic" role="tooltip">{semanticTooltip}</span>
          ) : null}
          {surface.kind === 'inventory' && !notice && !dyeModal ? (
            <NativeAction
              data={{ 'data-inventory-resume': 'true' }}
              gameBack
              label="Close inventory"
              rect={inventoryResumeRect}
              onClick={() => {
                audio.playSound('open-panel')
                onClose()
              }}
            />
          ) : surface.kind !== 'inventory' ? (
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

function NativeNpcNotebox({
  onClose,
  style,
  text,
}: {
  onClose: () => void
  style: CSSProperties
  text: string
}) {
  return (
    <div className="hub-native-notebox-overlay" data-native-notebox-text={text}>
      <section
        className="hub-native-notebox"
        role="alertdialog"
        aria-label="Boast notice"
        style={style}
      >
        <p>{text}</p>
        <button type="button" onClick={onClose}>OKAY</button>
      </section>
    </div>
  )
}

function DialogueActions({
  chat,
  interaction,
  onAccelerate,
  onAdvance,
  onChoice,
  onDone,
  onSelectRow,
  onSelectorDone,
  onSelectorOffset,
  pendingSelection,
  selectorRows,
  storyOffice,
}: {
  chat: HubNpcChatPresentation
  onAccelerate: () => void
  onAdvance: () => void
  onChoice: (choice: HubNpcChatChoice) => void
  onDone: () => void
  onSelectRow: (
    selector: 'boast' | 'books' | 'teacher-spells',
    id: number,
  ) => void
  onSelectorDone: () => void
  onSelectorOffset: (offset: number) => void
  pendingSelection: boolean
  selectorRows: readonly HubNpcSelectorRow[]
  storyOffice: boolean
  interaction: HubInteractionId
}) {
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
    const maximumOffset = Math.max(0, selectorRows.length - HUB_NPC_SELECTOR.rowCount)
    const offset = Math.min(chat.selectorOffset, maximumOffset)
    const visibleRows = selectorRows.slice(offset, offset + HUB_NPC_SELECTOR.rowCount)
    return (
      <section
        className="hub-native-dialogue-actions"
        aria-label={hubNpcSelectorTitle(selector)}
        data-native-selector={selector}
        data-native-selector-offset={offset}
      >
        <span className="hub-native-ui-semantic" role="status">
          {visibleRows.length === 0 && selector === 'teacher-spells'
            ? 'ALL SPELLS ALREADY BOUGHT!'
            : `${hubNpcSelectorTitle(selector)}. ${selectorRows.length} entries.`}
        </span>
        {visibleRows.map((row, index) => (
          <NativeAction
            key={`${selector}-${row.id}`}
            data={{
              'data-native-selector-id': row.id,
              'data-native-selector-kind': selector,
              'data-native-selector-price': row.price ?? '',
            }}
            disabled={pendingSelection}
            label={`${row.label}${row.price === null ? '' : `, ${row.price} gold`}. ${row.detail}`}
            rect={[
              HUB_NPC_SELECTOR.rowLeft,
              HUB_NPC_SELECTOR.rowTop + index * HUB_NPC_SELECTOR.rowHeight,
              HUB_NPC_SELECTOR.rowWidth,
              HUB_NPC_SELECTOR.rowHeight - 3,
            ]}
            onClick={() => onSelectRow(selector, row.id)}
          />
        ))}
        {offset > 0 ? (
          <NativeAction
            label="Previous entries"
            rect={HUB_NPC_SELECTOR.previousRect}
            onClick={() => onSelectorOffset(Math.max(0, offset - HUB_NPC_SELECTOR.rowCount))}
          />
        ) : null}
        {offset < maximumOffset ? (
          <NativeAction
            label="More entries"
            rect={HUB_NPC_SELECTOR.nextRect}
            onClick={() => onSelectorOffset(Math.min(
              maximumOffset,
              offset + HUB_NPC_SELECTOR.rowCount,
            ))}
          />
        ) : null}
        <NativeAction gameBack label="Done" rect={HUB_CHAT_PANEL.doneRect} onClick={onSelectorDone} />
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

function ServiceActions({
  economy,
  inventorySelection,
  onAction,
  onClose,
  onDragChange,
  onDragMove,
  onInsufficientGold,
  onInventoryAction,
  onInventorySelect,
  onInteractionSound,
  onFocusInspection,
  onHoverInspection,
  onNotice,
  onOpenDye,
  onPressedControl,
  onSelect,
  selection,
  trader,
}: {
  economy: ProtocolPlayerEconomy
  inventorySelection: HubInventorySelectionModel | null
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onInsufficientGold: () => void
  onInventoryAction: (action: HubInventoryAction) => void
  onInventorySelect: (selection: HubInventorySelectionModel | null) => void
  onInteractionSound: (cue: 'shop-activation' | 'storage-drag-start') => void
  onFocusInspection: (inspection: HubServiceInspectionModel | null) => void
  onHoverInspection: (inspection: HubServiceInspectionModel | null) => void
  onNotice: (notice: HubInventoryUiNotice) => void
  onOpenDye: (dyeItemId: number) => void
  onPressedControl: (control: HubInventoryPressedControl) => void
  onSelect: (selection: HubServiceSelection | null) => void
  selection: HubServiceSelection | null
  trader: HubTraderId
}) {
  const storageDropRect = [
    HUB_SHOP_GRID.left,
    HUB_SHOP_GRID.top,
    (HUB_SHOP_GRID.columns - 1) * HUB_SHOP_GRID.pitchX + HUB_SHOP_GRID.cellSize,
    (HUB_SHOP_GRID.rows - 1) * HUB_SHOP_GRID.pitchY + HUB_SHOP_GRID.cellSize,
  ] as const
  const companionInventory = (
    <InventoryActions
      companion
      economy={economy}
      selection={inventorySelection}
      storageDropRect={trader === 'luthacus' ? storageDropRect : null}
      onAction={onInventoryAction}
      onDragChange={onDragChange}
      onDragMove={onDragMove}
      onNotice={onNotice}
      onOpenDye={onOpenDye}
      onSelect={onInventorySelect}
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
              label={`Inspect ${HAGATHA_PERKS[selector]!.name}`}
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
  const projectedStorage = projectInventoryItems(economy.storage)
    .slice(0, HUB_SHOP_GRID.retainedCapacity)

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
        {projectedStorage.map(({ depth, item, parentSackId }, index) => {
          const position = hubShopSlotPosition(index)
          return (
            <NativeAction
              key={item.id}
              data={{
                'data-inventory-item-id': item.id,
                'data-inventory-depth': depth,
                'data-inventory-owner': 'storage',
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
          fromIndex={projectedStorage.length}
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
  const projected = projectInventoryItems(economy.backpack)
    .slice(0, HUB_INVENTORY_GRID.capacity)
  const eligibleIds = new Set(
    inventoryDyeableClothingItems(economy.backpack).map(({ item }) => item.id),
  )
  const targetIndex = modal.targetItemId === null
    ? -1
    : projected.findIndex(({ item }) => item.id === modal.targetItemId)
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
            ? projected.map(({ depth, item, parentSackId }, index) => {
                if (!eligibleIds.has(item.id)) return null
                const position = hubInventorySlotPosition(index)
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
      ) : targetIndex >= 0 ? (
        <>
          <NativeAction
            data={{
              'data-native-dye-layer': 'cloth',
              'data-native-dye-target': modal.targetItemId,
            }}
            disabled={blocked}
            label="Dye cloth"
            rect={hubDyeItemLayerRects(targetIndex).cloth}
            onClick={() => onCommit('cloth')}
          />
          <NativeAction
            data={{
              'data-native-dye-layer': 'trim',
              'data-native-dye-target': modal.targetItemId,
            }}
            disabled={blocked}
            label="Dye trim"
            rect={hubDyeItemLayerRects(targetIndex).trim}
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

function InventoryActions({
  companion = false,
  economy,
  onAction,
  onDragChange,
  onDragMove,
  onNotice,
  onOpenDye,
  onSelect,
  selection,
  storageDropRect = null,
}: {
  companion?: boolean
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onNotice: (notice: HubInventoryUiNotice) => void
  onOpenDye: (dyeItemId: number) => void
  onSelect: (selection: HubInventorySelectionModel | null) => void
  selection: HubInventorySelectionModel | null
  storageDropRect?: readonly [number, number, number, number] | null
}) {
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const projectedBackpack = projectInventoryItems(economy.backpack)
    .slice(0, HUB_INVENTORY_GRID.capacity)
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
        onNotice,
        companion,
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
        rect={[0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height]}
        tabIndex={-1}
        onClick={clearInventorySelection}
      />
      <section aria-label="Backpack">
        {projectedBackpack.map(({ depth, item, parentSackId }, index) => {
          const position = hubInventorySlotPosition(index)
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
                'data-parent-sack-id': parentSackId ?? '',
                'data-selected': selection?.id === item.id && selection.owner === 'backpack' ? 'true' : 'false',
              }}
              label={`${item.name}, quantity ${item.quantity}`}
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
  event: ReactPointerEvent<HTMLButtonElement>,
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

function dropInventorySource(
  source: InventoryPointerSource,
  point: { readonly x: number; readonly y: number },
  economy: ProtocolPlayerEconomy,
  thirdRingUnlocked: boolean,
  onAction: (action: HubInventoryAction) => void,
  onNotice: (notice: HubInventoryUiNotice) => void,
  companion: boolean,
  storageDropRect: readonly [number, number, number, number] | null,
): void {
  if (source.owner === 'backpack') {
    const projected = projectInventoryItems(economy.backpack)
      .slice(0, HUB_INVENTORY_GRID.capacity)
    const sourceEntry = projected.find(({ item }) => item.id === source.itemId)
    const item = sourceEntry?.item ?? null
    if (!item) return
    if (pointInRect(point, HUB_UNFORGE_TARGET.rect)) {
      if (!nativeInventoryItemCanUnforge(item)) return
      if (item.nativeTypeId === 7008) {
        if ((item.contents?.length ?? 0) === 0) onAction({ type: 'unforge', itemId: item.id })
        return
      }
      onNotice({ ...HUB_UNFORGE_CONFIRMATION_NOTICE, unforgeItemId: item.id })
      return
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
    const destinationSack = projected.find(({ item: candidate }, index) => {
      if (candidate.nativeTypeId !== 7008) return false
      const position = hubInventorySlotPosition(index)
      return pointInRect(point, [
        position.x,
        position.y,
        HUB_INVENTORY_GRID.cellSize,
        HUB_INVENTORY_GRID.cellSize,
      ])
    })?.item ?? null
    if (destinationSack) {
      onAction({
        type: 'move-inventory-item',
        destinationSackId: destinationSack.id,
        itemId: item.id,
      })
      return
    }
    const backpackRect = [
      HUB_INVENTORY_GRID.left,
      HUB_INVENTORY_GRID.top,
      (HUB_INVENTORY_GRID.columns - 1) * HUB_INVENTORY_GRID.pitch
        + HUB_INVENTORY_GRID.cellSize,
      (HUB_INVENTORY_GRID.rows - 1) * HUB_INVENTORY_GRID.pitch
        + HUB_INVENTORY_GRID.cellSize,
    ] as const
    if (sourceEntry && sourceEntry.parentSackId !== null && pointInRect(point, backpackRect)) {
      onAction({
        type: 'move-inventory-item',
        destinationSackId: null,
        itemId: item.id,
      })
    }
    return
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
  onClear,
}: {
  dowsing?: boolean
  fromIndex: number
  onClear: () => void
}) {
  const capacity = dowsing
    ? HUB_DOWSING_GRID.retainedCapacity
    : HUB_SHOP_GRID.retainedCapacity
  return Array.from({ length: Math.max(0, capacity - fromIndex) }, (_, offset) => {
    const index = fromIndex + offset
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
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  onPressedChange,
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
  onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPressedChange?: (pressed: boolean) => void
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
      trader !== 'hagatha'
      || economy.ownedPerkSelectors[inspection.index] !== inspection.selector
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
    ownedPerkSelectors: economy.ownedPerkSelectors,
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
