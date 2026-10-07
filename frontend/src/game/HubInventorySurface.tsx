import HotbarControls, { useHotbar } from './HotbarControls.tsx'
import type { InventoryRunSummary } from './hub-inventory-ui-model.ts'
import {
  hubInventorySurfaceDiagnostics,
  hubInventorySurfaceLabel,
  hubInventorySurfaceTooltip,
} from './hub-inventory-surface-presentation.ts'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import {
  MAX_NATIVE_DYE_SELECTIONS,
  findInventoryItem,
  inventoryItemsAtSackPath,
  inventoryDyeableClothingItems,
  type HubInventoryAction,
  type HubTraderId,
} from './core-kernels/hub-economy.ts'
import { nativeBeltOwnedItem, type PlayerBeltComponent } from './core-kernels/native-belt.ts'
import type { NativeSecondaryPlayerState } from './core-kernels/native-secondary-abilities.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import { NATIVE_SELECTOR_ACCEPT_TICKS } from './core-kernels/native-hub-npc.ts'
import type { ModBoastSelection } from './core-kernels/boast.ts'
import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'
import type { HubMemorialState } from './core-kernels/hub-memorial.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { quickbarSlotForBinding, type GameControlBindings } from './game-settings.ts'
import { NATIVE_HUD_BACKBUFFER, nativeHudModalSlideLayout } from './native-hud-layout.ts'
import {
  initialNativeModalSlideProgressSnapshot,
  nativeModalSlideProgressSnapshot,
  subscribeNativeModalSlideProgress,
} from './native-modal-slide-progress.ts'
import { nativeOptionalBookHudProgress } from './native-optional-book.ts'
import {
  hubMemorialEulogyIndex,
  hubMemorialPortraitForInteraction,
} from './hub-inventory-presentation.ts'
import {
  createHubNpcChatContent,
  consumeHubNpcSpeech,
  hubNpcChatChoiceContent,
  hubNpcQuestion,
  hubNpcSelectorAction,
  hubBoastInstruction,
  hubNpcSelectorContent,
  hubNpcSelectorResponse,
  hubNpcSelectorRows,
  type HubNpcChatContent,
  type HubNpcSelectorRow,
} from './hub-npc-dialogue.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from './protocol/game-state.ts'
import type {
  ModContentProjection,
} from './protocol/game-mod-contract.ts'
import type { HubInventoryRenderer } from './renderer/hub-inventory-renderer.ts'
import type {
  HubInventoryDragModel,
  HubInventoryDyeModalModel,
  HubInventoryPressedControl,
  HubInventoryRendererModel,
  HubInventorySackTransitionModel,
  HubInventorySelectionModel,
  HubServiceInspectionModel,
} from './renderer/hub-inventory/model.ts'
import type { RetainedRendererOwner } from './renderer/retained-renderer-owner.ts'
import {
  HUB_DYE_CLOTHING,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_INVENTORY_INTERACTION,
  hubHagathaFullMindNotice,
} from './renderer/hub-inventory-render-contract.ts'
import type {
  HubUiSurface,
  HubNpcChatPresentation,
  PendingHubNpcSelection,
  HubServiceSelection,
} from './hub-inventory-ui-model.ts'
import { useHubInventoryFlybys } from './use-hub-inventory-flybys.ts'
import { useHubInventoryRenderer } from './use-hub-inventory-renderer.ts'
import { HubInventoryNotice } from './HubInventoryNotice.tsx'
import { HubInventoryFooter } from './HubInventoryControls.tsx'
import { DialogueActions } from './HubDialogueActions.tsx'
import { InventoryActions } from './HubInventoryActions.tsx'
import { ServiceActions } from './HubServiceActions.tsx'
import { DyeClothingActions } from './HubDyeClothingActions.tsx'
import { EQUIPMENT_SLOT_ORDER, itemAtEquipmentSlot } from './hub-inventory-equipment.ts'
import { type HubInventoryUiNotice, unforgeResultNotice } from './hub-inventory-notices.ts'

export function NativeHubSurface({
  audio,
  belt: allBeltEntries,
  beltBindings,
  closing,
  config,
  dialogueHistory,
  economy,
  forceModalHudSettled,
  inputSuspended,
  menuKeyCode,
  mode,
  memorial,
  modContent,
  onAction,
  onBeltActivate: onAbsoluteBeltActivate,
  onClose,
  onInventoryCloseComplete,
  onInventoryBack,
  onNotebox,
  onOpenSack,
  onOpenSkills,
  onSurfaceChange,
  onUnassignBeltEntry,
  progression,
  runSummary,
  secondaryPlayerState,
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
  beltBindings: GameControlBindings
  closing: boolean
  config: PlayerCharacterConfig
  dialogueHistory: Set<string>
  economy: ProtocolPlayerEconomy
  forceModalHudSettled: boolean
  inputSuspended: boolean
  menuKeyCode: string
  mode: 'hub' | 'run'
  memorial: HubMemorialState | null
  modContent: ModContentProjection | null
  onAction: (action: HubInventoryAction) => void
  onBeltActivate: (slot: number, pointer: Vector2 | null) => void
  onClose: () => void
  onInventoryCloseComplete: () => void
  onInventoryBack: () => void
  onNotebox: (text: string) => void
  onOpenSack: (sackId: number) => void
  onOpenSkills: () => void
  onSurfaceChange: (surface: HubUiSurface) => void
  onUnassignBeltEntry?: (slot: number) => void
  progression: ProtocolPlayerProgression
  runSummary: InventoryRunSummary | null
  secondaryPlayerState: NativeSecondaryPlayerState | undefined
  replacementTarget: 'closed' | 'skills' | null
  rendererOwner: RetainedRendererOwner<HubInventoryRenderer>
  sackPath: readonly number[]
  sackTransition: HubInventorySackTransitionModel | null
  skorchaDismissalIndex: number
  style: CSSProperties
  surface: Exclude<HubUiSurface, null>
  storyOffice: boolean
}) {
  const { bank } = useHotbar()
  const belt = useMemo(() => allBeltEntries.slice(bank * 8, bank * 8 + 8), [allBeltEntries, bank])
  const onBeltActivate = useCallback((slot: number, pointer: Vector2 | null) => {
    onAbsoluteBeltActivate(bank * 8 + slot, pointer)
  }, [bank, onAbsoluteBeltActivate])
  const collegeIntroAcknowledgedRef = useRef(false)
  const chatCompletionHandledRef = useRef(false)
  const advanceChatRef = useRef<() => void>(() => undefined)
  const chatRandomIndexRef = useRef(
    surface.kind === 'dialogue' && surface.interaction === 'skorcha'
      ? skorchaDismissalIndex
      : economy.revision + economy.npc.boast.failureSequence,
  )
  const selectorResponseTimeoutRef = useRef<number | null>(null)
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
          dialogueHistory,
        )
      : { kind: 'choices' },
    phaseStartedAtMs: performance.now(),
    selectorScroll: 0,
  }))
  const [pendingNpcSelection, setPendingNpcSelection] =
    useState<PendingHubNpcSelection | null>(null)
  const [serviceSelection, setServiceSelection] = useState<HubServiceSelection | null>(null)
  const [dowsingReferenceItemId, setDowsingReferenceItemId] = useState<number | null>(null)
  const dowsingReferenceItem = dowsingReferenceItemId === null ? null
    : nativeBeltOwnedItem(economy, dowsingReferenceItemId)
  const [serviceHoverInspection, setServiceHoverInspection] = useState<HubServiceInspectionModel | null>(null)
  const [serviceFocusInspection, setServiceFocusInspection] = useState<HubServiceInspectionModel | null>(null)
  const [inventorySelection, setInventorySelection] = useState<HubInventorySelectionModel | null>(null)
  const [inventoryDrag, setInventoryDrag] = useState<HubInventoryDragModel | null>(null)
  const [releasedInventoryDrag, setReleasedInventoryDrag] = useState<{
    readonly action: HubInventoryAction['type']
    readonly drag: HubInventoryDragModel
    readonly feedbackSequence: number
    readonly laterActionTypes: readonly HubInventoryAction['type'][]
    readonly sackPath: readonly number[]
  } | null>(null)
  // Source suppression and the dragger retire together with the host result,
  // including rejection. Clearing on pointer-up exposes the old snapshot.
  const dropFeedback = economy.actionFeedback
  const dropAcknowledged = releasedInventoryDrag !== null && dropFeedback !== null
    && dropFeedback.sequence > releasedInventoryDrag.feedbackSequence
    && (dropFeedback.action === releasedInventoryDrag.action
      || (dropFeedback.sequence > releasedInventoryDrag.feedbackSequence + 1
        && releasedInventoryDrag.laterActionTypes.some(type => type === dropFeedback.action)))
  const awaitingInventoryDrop = releasedInventoryDrag !== null
    && releasedInventoryDrag.sackPath === sackPath
    && !dropAcknowledged
  const displayedInventoryDrag = inventoryDrag
    ?? (awaitingInventoryDrop ? releasedInventoryDrag.drag : null)
  useEffect(() => {
    if (!awaitingInventoryDrop) setReleasedInventoryDrag(null)
  }, [awaitingInventoryDrop])
  const dispatchInventoryAction = (action: HubInventoryAction, drag?: HubInventoryDragModel) => {
    if (drag) setReleasedInventoryDrag({
      action: action.type,
      drag,
      feedbackSequence: economy.actionFeedback?.sequence ?? 0,
      laterActionTypes: [],
      sackPath,
    })
    else setReleasedInventoryDrag(current => current !== null
      && current.sackPath === sackPath
      && !current.laterActionTypes.includes(action.type)
      ? { ...current, laterActionTypes: [...current.laterActionTypes, action.type] }
      : current)
    onAction(action)
  }
  const [statsPage, setStatsPage] = useState(0)
  const [dyeModal, setDyeModal] = useState<HubInventoryDyeModalModel | null>(null)
  const dyeSessionIdRef = useRef<string | null>(null)
  const dyeActionRef = useRef(onAction)
  dyeActionRef.current = onAction
  useEffect(() => () => {
    if (dyeSessionIdRef.current !== null) {
      dyeActionRef.current({ type: 'close-dye', sessionId: dyeSessionIdRef.current })
    }
  }, [])
  const feedbackSequenceRef = useRef(economy.actionFeedback?.sequence ?? 0)
  const { inventoryFlyby, inventoryFlybys, startInventoryFlyby } = useHubInventoryFlybys(
    economy.actionFeedback, onAction, sackPath,
  )
  const inventoryTransitionLocked = sackTransition !== null || inventoryFlyby !== null
    || awaitingInventoryDrop

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
          selectorScroll: 0,
        })
      }, NATIVE_SELECTOR_ACCEPT_TICKS * 10)
      return
    }
    if (feedback.action === 'close-dye') return
    if ((feedback.action === 'open-dye' || feedback.action === 'dye')
      && feedback.dyeSessionId !== dyeSessionIdRef.current) return
    if (feedback.action === 'open-dye') {
      if (!feedback.accepted) {
        audio.playSound('bad-action')
        dyeSessionIdRef.current = null
        setDyeModal(null)
        return
      }
      if (economy.dyeSessionId !== dyeSessionIdRef.current) {
        dyeSessionIdRef.current = null
        setDyeModal(null)
      } else {
        setDyeModal(current => current ? { ...current, admitted: true, pending: false } : current)
      }
      return
    }
    if (feedback.action === 'dye') {
      if (!feedback.accepted) {
        audio.playSound('bad-action')
        setDyeModal((current) => current?.admitted ? { ...current, pending: false } : current)
        return
      }
      audio.playStream('dye')
      setDyeModal((current) => current?.admitted ? {
        ...current,
        pending: false,
        targetItemId: null,
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
    playSuccessfulInventoryFeedback(audio, feedback, onClose)
  }, [audio, economy.actionFeedback, economy.dyeSessionId, modContent, onClose, pendingNpcSelection, serviceSelection?.id])

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
    setReleasedInventoryDrag(null)
  }, [sackPath])

  useEffect(() => {
    if (!dyeModal || dyeModal.closingAtMs !== null) return
    if (dyeModal.admitted && economy.dyeSessionId !== dyeModal.sessionId) {
      dyeSessionIdRef.current = null
      setDyeModal(null)
      return
    }
    if (dyeModal.pending) return
    if (dyeModal.targetItemId !== null
      && !inventoryDyeableClothingItems(economy.backpack).some(
        ({ item }) => item.id === dyeModal.targetItemId,
      )) {
      setDyeModal((current) => current ? { ...current, targetItemId: null } : current)
    }
  }, [dyeModal, economy.backpack, economy.dyeSessionId])

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

  // Keep initial render pure (including React StrictMode's repeated initializer).
  // Native selection retires the row once the committed speech starts.
  useEffect(() => {
    if (surface.kind === 'dialogue' && chat.content.kind === 'speech') {
      consumeHubNpcSpeech(dialogueHistory, surface.interaction, chat.content.key, storyOffice)
    }
  }, [chat.content, dialogueHistory, storyOffice, surface])

  const beginChatContent = useCallback((content: HubNpcChatContent) => {
    if (surface.kind === 'dialogue') {
      if (content.kind === 'speech') {
        consumeHubNpcSpeech(dialogueHistory, surface.interaction, content.key, storyOffice)
      } else if (content.kind === 'choices') {
        content = hubNpcChatChoiceContent(surface.interaction, storyOffice, dialogueHistory)
      }
    }
    chatCompletionHandledRef.current = false
    setHighlightedNpcSelectorId(null)
    setChat({
      acceleratedAtMs: null,
      content,
      phaseStartedAtMs: performance.now(),
      selectorScroll: 0,
    })
  }, [dialogueHistory, storyOffice, surface])

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
      surface,
  ])
  advanceChatRef.current = advanceChat

  const dismissOrCloseChat = useCallback(() => {
    if (surface.kind === 'dialogue') onClose()
  }, [onClose, surface])

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

  useEffect(() => {
    if (surface.kind === 'dialogue' || inputSuspended || closing) return
    const activate = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey
        || inventoryTransitionLocked || notice !== null || dyeModal !== null
        || !onUnassignBeltEntry) return
      const slot = quickbarSlotForBinding(beltBindings, event.code)
      if (slot === null || belt[slot] === null) return
      event.preventDefault()
      event.stopImmediatePropagation()
      onBeltActivate(slot, null)
    }
    window.addEventListener('keydown', activate, { capture: true })
    return () => window.removeEventListener('keydown', activate, { capture: true })
  }, [
    belt, beltBindings, closing, dyeModal, inputSuspended, inventoryTransitionLocked,
    notice, onBeltActivate, onUnassignBeltEntry, surface.kind,
  ])

  const model = useMemo((): HubInventoryRendererModel => {
    if (surface.kind === 'inventory') return {
      belt,
      config,
      dragging: displayedInventoryDrag,
      dyeModal,
      economy,
      flybys: inventoryFlybys,
      inspection: serviceHoverInspection ?? serviceFocusInspection,
      kind: 'inventory',
      runSummary,
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
      selectorScroll: chat.selectorScroll,
      selectorRows,
      storyOffice,
    }
    return {
      belt,
      config,
      dragging: displayedInventoryDrag,
      dyeModal,
      economy,
      flybys: inventoryFlybys,
      inspection: serviceHoverInspection ?? serviceFocusInspection,
      inventorySelection,
      kind: 'service',
      runSummary,
      dowsingReferenceItem,
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
    dowsingReferenceItem,
    dyeModal,
    displayedInventoryDrag,
    inventoryFlybys,
    inventorySelection,
    highlightedNpcSelectorId,
    notice,
    pendingNpcSelection,
    pressedControl,
    progression,
    runSummary,
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

  const { hostRef, rendererRef, rendererState, statsOffset } = useHubInventoryRenderer({
    rendererOwner, model, closing, forceModalHudSettled, onInventoryCloseComplete,
    chatCompletionHandledRef, advanceChatRef,
    beltAvailability: { mode, progression, playerState: secondaryPlayerState },
  })

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
    if (dowsingReferenceItemId !== null && dowsingReferenceItem === null) {
      setDowsingReferenceItemId(null)
    }
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
  }, [dowsingReferenceItem, dowsingReferenceItemId, economy, inventorySelection, sackPath, serviceSelection, surface])

  const click = (action: () => void) => {
    audio.playSound('click')
    action()
  }
  const openDye = (dyeItemId: number) => {
    audio.playSound('click')
    setNotice(null)
    setInventoryDrag(null)
    const sessionId = crypto.randomUUID()
    dyeSessionIdRef.current = sessionId
    setDyeModal({
      admitted: false,
      closingAtMs: null,
      dyeItemId,
      openedAtMs: performance.now(),
      path: sackPath,
      pending: true,
      selectedAtMs: null,
      selectedRow: null,
      sessionId,
      swatchRows: [],
      targetItemId: null,
    })
    onAction({ type: 'open-dye', dyeItemId, sessionId })
  }
  const cancelDye = () => {
    if (!dyeModal || dyeModal.closingAtMs !== null || dyeModal.pending) return
    if (dyeModal.targetItemId !== null) {
      setDyeModal(current => current ? { ...current, targetItemId: null } : current)
      return
    }
    dyeSessionIdRef.current = null
    onAction({ type: 'close-dye', sessionId: dyeModal.sessionId })
    setDyeModal(current => current ? { ...current, closingAtMs: performance.now() } : current)
  }

  const label = hubInventorySurfaceLabel(surface, storyOffice)
  const semanticTooltip = hubInventorySurfaceTooltip(
    surface, serviceHoverInspection ?? serviceFocusInspection, economy, progression,
  )

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
        data-native-dowsing-reference={dowsingReferenceItem?.id ?? ''}
        {...hubInventorySurfaceDiagnostics({
          chat, dyeModal, inventoryDrag: displayedInventoryDrag, inventorySelection, notice, pressedControl,
          sackPath, sackTransition, semanticTooltip, statsPage, surface,
        })}
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
                  sessionId: dyeModal.sessionId,
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
            <HubInventoryNotice
              notice={notice}
              onCommit={() => {
                setPressedControl(null)
                click(() => {
                  if (notice.variant === 'unforge-confirmation' && notice.unforgeItemId !== undefined) {
                    onAction({ type: 'unforge', itemId: notice.unforgeItemId })
                  }
                  setNotice(null)
                })
              }}
              onDismiss={() => click(() => setNotice(null))}
              onPressedControl={setPressedControl}
            />
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
                    dialogueHistory,
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
              dowsingReferenceItemId={dowsingReferenceItem?.id ?? null}
              inventorySelection={inventorySelection}
              selection={serviceSelection}
              trader={surface.trader}
              onAction={(action, drag) => {
                if (action.type.startsWith('buy-')) audio.playSound('click')
                dispatchInventoryAction(action, drag)
              }}
              onInventoryAction={(action, drag) => {
                if (action.type !== 'consume' && action.type !== 'transfer'
                  && action.type !== 'unforge' && action.type !== 'equip'
                  && action.type !== 'move-inventory-item') audio.playSound('click')
                dispatchInventoryAction(action, drag)
              }}
              onBeltBind={(itemId, slot) => {
                audio.playSound('pick-skill')
                onAction({ itemId, slot: bank * 8 + slot, type: 'bind-belt-item' })
              }}
              onOpenSack={onOpenSack}
              onInventoryBack={onInventoryBack}
              onClose={() => {
                audio.playSound('open-panel')
                onClose()
              }}
              onDragChange={setInventoryDrag}
              onDragMove={(point) => rendererRef.current?.moveDrag(point)}
              onDowsingReference={(itemId) => {
                setDowsingReferenceItemId(itemId)
                audio.playSound('backpack-open')
                audio.playSound('backpack-close')
              }}
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
              transitionLocked={inventoryTransitionLocked}
              onSelect={setServiceSelection}
            />
          ) : (
            <InventoryActions
              beltRects={inventoryBeltRects}
              economy={economy}
              selection={inventorySelection}
              onAction={(action, drag) => {
                if (action.type !== 'consume' && action.type !== 'unforge'
                  && action.type !== 'bind-belt-item' && action.type !== 'equip'
                  && action.type !== 'move-inventory-item') {
                  audio.playSound('click')
                }
                dispatchInventoryAction(action, drag)
              }}
              onBeltBind={(itemId, slot) => {
                audio.playSound('pick-skill')
                onAction({ itemId, slot: bank * 8 + slot, type: 'bind-belt-item' })
              }}
              onDragChange={setInventoryDrag}
              onDragMove={(point) => rendererRef.current?.moveDrag(point)}
              onNotice={setNotice}
              onFlyby={startInventoryFlyby}
              onMoveSound={(cue, playbackRate) => audio.playSound(cue, { playbackRate })}
              onOpenDye={openDye}
              onOpenSack={onOpenSack}
              onInventoryBack={onInventoryBack}
              onSelect={(next) => {
                audio.playSound('click')
                setInventorySelection(next)
              }}
              sackPath={sackPath}
              transitionLocked={inventoryTransitionLocked}
            />
          )}
          {surface.kind !== 'dialogue' && notice === null && dyeModal === null ? (
            <HotbarControls rects={inventoryBeltRects}
              disabled={inputSuspended || closing || inventoryTransitionLocked} />
          ) : null}
          <HubInventoryFooter
            blocked={notice !== null || dyeModal !== null}
            surface={surface}
            stats={{
              companion: surface.kind === 'service', economy, page: statsPage, offset: statsOffset,
              onInspectionFocus: setServiceFocusInspection,
              onInspectionHover: setServiceHoverInspection,
              onPage: (nextPage) => {
                setServiceFocusInspection(null)
                setServiceHoverInspection(null)
                setStatsPage(nextPage)
              },
            }}
            belt={{
              audio, bank, belt,
              disabled: inventoryTransitionLocked || !onUnassignBeltEntry,
              onActivate: onBeltActivate,
              onPullOff: (slot) => onUnassignBeltEntry?.(bank * 8 + slot),
              rects: inventoryBeltRects,
            }}
            skillsRect={inventorySkillsRect}
            resumeRect={inventoryResumeRect}
            semanticTooltip={semanticTooltip}
            hasParentSack={sackPath.length > 0}
            label={label}
            onOpenSkills={onOpenSkills}
            onInventoryBack={onInventoryBack}
            onClose={onClose}
          />
        </div>
        {rendererState === 'error' ? (
          <p className="hub-native-ui-error" role="alert">Native inventory renderer unavailable.</p>
        ) : null}
      </section>
    </div>
  )
}

function playSuccessfulInventoryFeedback(
  audio: GameAudioDirector,
  feedback: NonNullable<ProtocolPlayerEconomy['actionFeedback']>,
  onClose: () => void,
): void {
  if (feedback.action === 'buy-hagatha' || feedback.action === 'buy-fomentius') {
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
    onClose()
    return
  }
  if (feedback.action === 'transfer') {
    if (feedback.transferGesture === 'double-activation') audio.playSound('backpack-close')
    else audio.playSound('click', { playbackRate: 0.75 })
  }
}
