import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import nativeAssetsJson from '../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import {
  DOWSING_EQUIPMENT_RECIPES,
  type EquipmentSlot,
  type HubInventoryAction,
  type HubInventoryItem,
  type HubShopItem,
  type HubTraderId,
} from './core-kernels/hub-economy.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import {
  HUB_TRADER_DIALOGUES,
  equipmentSlotsForItem,
  hubTraderWithinServiceRange,
  nearestHubTrader,
} from './hub-inventory-presentation.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from './protocol/game-state.ts'
import {
  createHubInventoryRenderer,
  type HubInventoryDragModel,
  type HubInventoryRenderer,
  type HubInventoryRendererModel,
  type HubInventoryRendererNotice,
  type HubInventorySelectionModel,
  type HubTraderChatPhase,
} from './renderer/hub-inventory-renderer.ts'
import {
  HUB_CHAT_PANEL,
  HUB_DOWSING_GRID,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_HAT_REMOVAL_MSGBOX,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_INTERACTION,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_TIMING,
  HUB_ROBE_REMOVAL_MSGBOX,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  hubDowsingSlotPosition,
  hubInventoryEquipmentSlotRects,
  hubInventorySlotPosition,
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

export type HubUiSurface =
  | { readonly kind: 'dialogue'; readonly trader: HubTraderId }
  | { readonly kind: 'inventory' }
  | { readonly kind: 'service'; readonly trader: HubTraderId }
  | null

interface HubInventoryUiProps {
  audio: GameAudioDirector
  config: PlayerCharacterConfig
  disabled: boolean
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onSurfaceChange: (surface: HubUiSurface) => void
  playerPosition: Vector2
  progression: ProtocolPlayerProgression
  region: HubRegionId
  surface: HubUiSurface
  transitionActive: boolean
  tradersEnabled?: boolean
}

export default function HubInventoryUi({
  audio,
  config,
  disabled,
  economy,
  onAction,
  onSurfaceChange,
  playerPosition,
  progression,
  region,
  surface,
  transitionActive,
  tradersEnabled = true,
}: HubInventoryUiProps) {
  const nearestTrader = useMemo(
    () => disabled || transitionActive || !tradersEnabled
      ? null
      : nearestHubTrader(region, playerPosition),
    [disabled, playerPosition, region, tradersEnabled, transitionActive],
  )

  const closeSurface = useCallback(() => {
    if (surface?.kind === 'service' && surface.trader === 'shlorio'
      && economy.dowsingOffers.length > 0) {
      onAction({ type: 'close-dowsing' })
    }
    onSurfaceChange(null)
  }, [economy.dowsingOffers.length, onAction, onSurfaceChange, surface])

  useEffect(() => {
    if (!surface) return
    if (transitionActive || disabled) {
      closeSurface()
      return
    }
    if ('trader' in surface && !hubTraderWithinServiceRange(
      surface.trader,
      region,
      playerPosition,
    )) closeSurface()
  }, [closeSurface, disabled, playerPosition, region, surface, transitionActive])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.key === 'Escape' && surface) {
        event.preventDefault()
        event.stopPropagation()
        if (surface.kind !== 'dialogue') audio.playSound('open-panel')
        closeSurface()
        return
      }
      if (!surface && !disabled && !transitionActive && event.code === 'KeyI') {
        event.preventDefault()
        event.stopPropagation()
        onSurfaceChange({ kind: 'inventory' })
        return
      }
      if (surface || !nearestTrader || (event.code !== 'KeyE' && event.key !== 'Enter')) return
      event.preventDefault()
      event.stopPropagation()
      audio.playSound('click')
      onSurfaceChange({ kind: 'dialogue', trader: nearestTrader })
    }
    window.addEventListener('keydown', keyDown, { capture: true })
    return () => window.removeEventListener('keydown', keyDown, { capture: true })
  }, [audio, closeSurface, disabled, nearestTrader, onSurfaceChange, surface, transitionActive])

  if (!surface) {
    return nearestTrader ? (
      <button
        type="button"
        className="hub-trader-interact"
        data-hub-trader={nearestTrader}
        aria-label={`Talk to ${HUB_TRADER_DIALOGUES[nearestTrader].name}`}
        onClick={() => {
          audio.playSound('click')
          onSurfaceChange({ kind: 'dialogue', trader: nearestTrader })
        }}
      />
    ) : null
  }

  const surfaceKey = `${surface.kind}-${'trader' in surface ? surface.trader : 'player'}`
  return (
    <NativeHubSurface
      key={surfaceKey}
      audio={audio}
      config={config}
      economy={economy}
      onAction={onAction}
      onClose={closeSurface}
      onSurfaceChange={onSurfaceChange}
      progression={progression}
      surface={surface}
    />
  )
}

function NativeHubSurface({
  audio,
  config,
  economy,
  onAction,
  onClose,
  onSurfaceChange,
  progression,
  surface,
}: {
  audio: GameAudioDirector
  config: PlayerCharacterConfig
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onSurfaceChange: (surface: HubUiSurface) => void
  progression: ProtocolPlayerProgression
  surface: Exclude<HubUiSurface, null>
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<HubInventoryRenderer | null>(null)
  const modelRef = useRef<HubInventoryRendererModel | null>(null)
  const revealStartedAtRef = useRef<number | null>(null)
  const chatCompletionHandledRef = useRef(false)
  const [rendererState, setRendererState] = useState<'error' | 'loading' | 'ready'>('loading')
  const [notice, setNotice] = useState<HubInventoryRendererNotice | null>(null)
  const [chat, setChat] = useState<{
    acceleratedAtMs: number | null
    phase: HubTraderChatPhase
    phaseStartedAtMs: number
  }>(() => ({ acceleratedAtMs: null, phase: 'intro', phaseStartedAtMs: performance.now() }))
  const [serviceSelection, setServiceSelection] = useState<HubServiceSelection | null>(null)
  const [inventorySelection, setInventorySelection] = useState<HubInventorySelectionModel | null>(null)
  const [inventoryDrag, setInventoryDrag] = useState<HubInventoryDragModel | null>(null)
  const feedbackSequenceRef = useRef(economy.actionFeedback?.sequence ?? 0)

  useEffect(() => {
    const feedback = economy.actionFeedback
    if (!feedback || feedback.sequence <= feedbackSequenceRef.current) return
    feedbackSequenceRef.current = feedback.sequence
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
    if (feedback.action === 'transfer') {
      if (feedback.transferGesture === 'double-activation') audio.playSound('backpack-close')
      else audio.playSound('click', { playbackRate: 0.75 })
    }
  }, [audio, economy.actionFeedback])

  const beginChatPhase = useCallback((phase: HubTraderChatPhase) => {
    chatCompletionHandledRef.current = false
    setChat({ acceleratedAtMs: null, phase, phaseStartedAtMs: performance.now() })
  }, [])

  const model = useMemo((): HubInventoryRendererModel => {
    if (surface.kind === 'inventory') return {
      config,
      dragging: inventoryDrag,
      economy,
      kind: 'inventory',
      notice,
      progression,
      selection: inventorySelection,
    }
    if (surface.kind === 'dialogue') return {
      acceleratedAtMs: chat.acceleratedAtMs,
      kind: 'dialogue',
      phase: chat.phase,
      phaseStartedAtMs: chat.phaseStartedAtMs,
      trader: surface.trader,
    }
    return {
      config,
      dragging: inventoryDrag,
      economy,
      inventorySelection,
      kind: 'service',
      notice,
      progression,
      selectedItemId: serviceSelection?.id ?? null,
      selectedOwner: serviceSelection?.owner ?? null,
      trader: surface.trader,
    }
  }, [chat, config, economy, inventoryDrag, inventorySelection, notice, progression, serviceSelection, surface])

  useLayoutEffect(() => {
    modelRef.current = model
    rendererRef.current?.setModel(model)
  }, [model])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let renderer: HubInventoryRenderer | undefined
    void createHubInventoryRenderer().then((created) => {
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
      const ticks = (nowMs - revealStartedAtRef.current) / 10
      const step = surface.kind === 'dialogue'
        ? HUB_NATIVE_UI_TIMING.chatRevealPerTick
        : HUB_NATIVE_UI_TIMING.inventoryRevealPerTick
      const frame = renderer.render(nowMs, Math.min(1, ticks * step))
      const current = modelRef.current
      if (frame.chatComplete && current?.kind === 'dialogue'
        && current.phase !== 'choices' && !chatCompletionHandledRef.current) {
        chatCompletionHandledRef.current = true
        beginChatPhase('choices')
      }
    })
    return () => {
      disposed = true
      unsubscribe()
      rendererRef.current = null
      renderer?.destroy()
      host.replaceChildren()
    }
  }, [beginChatPhase, surface.kind])

  useEffect(() => {
    if (surface.kind !== 'dialogue' && inventorySelection) {
      if (inventorySelection.owner === 'backpack') {
        const item = economy.backpack.find(({ id }) => id === inventorySelection.id)
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
          if (economy.backpack.some(({ id }) => id === inventorySelection.id)) {
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
        && economy.storage.some(({ id }) => id === serviceSelection.id)
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

  const label = surface.kind === 'inventory'
    ? 'Inventory'
    : surface.kind === 'dialogue'
      ? `Talking to ${HUB_TRADER_DIALOGUES[surface.trader].name}`
      : HUB_TRADER_DIALOGUES[surface.trader].title

  return (
    <section
      className="hub-native-ui-stage"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-native-ui-schema={nativeAssetsJson.schema}
      data-source-executable={nativeAssetsJson.sourceExecutableSha256}
      data-renderer-state={rendererState}
      data-native-chat-phase={surface.kind === 'dialogue' ? chat.phase : ''}
      data-native-notice={notice?.title ?? ''}
      data-native-inventory-selection={inventorySelection
        ? `${inventorySelection.owner}:${inventorySelection.equipmentSlot ?? inventorySelection.id}`
        : ''}
      data-native-inventory-dragging={inventoryDrag
        ? `${inventoryDrag.owner}:${inventoryDrag.equipmentSlot ?? inventoryDrag.itemId}`
        : ''}
    >
      <div ref={hostRef} className="hub-native-ui-renderer" aria-hidden />
      <div className="hub-native-ui-actions">
        <span className="hub-native-ui-semantic hub-gold-ledger" data-player-gold={economy.gold}>
          {economy.gold.toLocaleString()} gold
        </span>
        {notice ? (
          <>
            <span className="hub-native-ui-semantic" role="alert">
              {notice.title} {notice.body}
            </span>
            <NativeAction
              label={notice.actionLabel}
              rect={HUB_DOWSING_MSGBOX.primaryButtonRect}
              onClick={() => click(() => setNotice(null))}
            />
          </>
        ) : surface.kind === 'dialogue' ? (
          <DialogueActions
            chat={chat}
            trader={surface.trader}
            onClose={onClose}
            onAccelerate={() => setChat((current) => current.acceleratedAtMs === null
              ? { ...current, acceleratedAtMs: performance.now() }
              : current)}
            onAdvance={() => beginChatPhase('choices')}
            onPrices={() => click(() => beginChatPhase('prices'))}
            onService={() => click(() => onSurfaceChange({ kind: 'service', trader: surface.trader }))}
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
              if (action.type !== 'consume' && action.type !== 'transfer') audio.playSound('click')
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
            onNotice={setNotice}
            onSelect={setServiceSelection}
          />
        ) : (
          <InventoryActions
            economy={economy}
            selection={inventorySelection}
            onAction={(action) => {
              if (action.type !== 'consume') audio.playSound('click')
              onAction(action)
            }}
            onClose={() => {
              audio.playSound('open-panel')
              onClose()
            }}
            onDragChange={setInventoryDrag}
            onDragMove={(point) => rendererRef.current?.moveDrag(point)}
            onNotice={setNotice}
            onSelect={(next) => {
              audio.playSound('click')
              setInventorySelection(next)
            }}
          />
        )}
      </div>
      {rendererState === 'error' ? (
        <p className="hub-native-ui-error" role="alert">Native inventory renderer unavailable.</p>
      ) : null}
    </section>
  )
}

function DialogueActions({
  chat,
  onAccelerate,
  onAdvance,
  onClose,
  onPrices,
  onService,
  trader,
}: {
  chat: {
    acceleratedAtMs: number | null
    phase: HubTraderChatPhase
    phaseStartedAtMs: number
  }
  onAccelerate: () => void
  onAdvance: () => void
  onClose: () => void
  onPrices: () => void
  onService: () => void
  trader: HubTraderId
}) {
  const dialogue = HUB_TRADER_DIALOGUES[trader]
  const paragraphs = chat.phase === 'prices' ? dialogue.priceExplanation : dialogue.intro
  return (
    <div className="hub-native-dialogue-actions">
      <div className="hub-native-ui-semantic">
        {(chat.phase === 'choices' ? [] : paragraphs).map((line) => <p key={line}>{line}</p>)}
      </div>
      {chat.phase === 'choices' ? (
        <>
          <NativeAction
            data={{ 'data-service-trader': trader }}
            label={dialogue.actionLabel}
            rect={HUB_CHAT_PANEL.primaryChoiceRect}
            onClick={onService}
          />
          {dialogue.priceLabel ? (
            <NativeAction label={dialogue.priceLabel} rect={HUB_CHAT_PANEL.secondaryChoiceRect} onClick={onPrices} />
          ) : null}
          <NativeAction label="Done" rect={HUB_CHAT_PANEL.doneRect} onClick={onClose} />
        </>
      ) : (
        <>
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
        </>
      )}
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
  onNotice,
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
  onNotice: (notice: HubInventoryRendererNotice) => void
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
      showDone={false}
      storageDropRect={trader === 'luthacus' ? storageDropRect : null}
      onAction={onInventoryAction}
      onDragChange={onDragChange}
      onDragMove={onDragMove}
      onNotice={onNotice}
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
        onSelect={onSelect}
      />
    )
  } else if (trader === 'shlorio' && economy.dowsingOffers.length === 0) {
    serviceActions = (
      <>
        <NativeAction
          label={`DOWSE ${economy.dowsingFee.toLocaleString()} gold`}
          rect={HUB_DOWSING_PREROLL.buttonRect}
          onClick={() => economy.gold < economy.dowsingFee
            ? onInsufficientGold()
            : onAction({ type: 'dowse' })}
        />
        <NativeAction label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
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
            onClick={() => activateSelection(
              selection,
              { id: offer.selector, owner: null },
              (next) => {
                onInteractionSound('shop-activation')
                onSelect(next)
              },
              () => onAction({ type: 'buy-hagatha', selector: offer.selector }),
            )}
          />
        ))}
        <span className="hub-native-ui-semantic hub-charm-capacity">
          Charms and curses: {economy.ownedPerkSelectors.length} / {economy.charmCapacity}
        </span>
        <NativeAction label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
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
          />
        ))}
        <NativeAction label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
      </>
    )
  }

  return (
    <>
      {companionInventory}
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
  onInteractionSound,
  onSelect,
  selection,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onInteractionSound: (cue: 'shop-activation' | 'storage-drag-start') => void
  onSelect: (selection: HubServiceSelection | null) => void
  selection: HubServiceSelection | null
}) {
  const pressRef = useRef<StoragePointerPress | null>(null)
  const lastActivationRef = useRef<StorageActivation | null>(null)

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
    event.currentTarget.setPointerCapture(event.pointerId)
    pressRef.current = {
      activeDrag: false,
      itemId,
      pointerId: event.pointerId,
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
    if (pressRef.current?.pointerId !== event.pointerId) return
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
        {economy.storage.slice(0, HUB_SHOP_GRID.retainedCapacity).map((item, index) => {
          const position = hubShopSlotPosition(index)
          return (
            <NativeAction
              key={item.id}
              data={{
                'data-inventory-item-id': item.id,
                'data-inventory-owner': 'storage',
                'data-selected': sourceIsSelected(item.id) ? 'true' : 'false',
              }}
              label={`${item.name}, quantity ${item.quantity}`}
              rect={[
                position.x,
                position.y,
                HUB_SHOP_GRID.cellSize,
                HUB_SHOP_GRID.cellSize,
              ]}
              onKeyDown={keyboardActivate(item.id)}
              onPointerCancel={cancelPointer}
              onPointerDown={beginPointer(item.id)}
              onPointerMove={movePointer}
              onPointerUp={finishPointer}
            />
          )
        })}
      </section>
      <NativeAction label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
    </>
  )
}

interface StoragePointerPress {
  activeDrag: boolean
  readonly itemId: number
  readonly pointerId: number
  readonly start: { readonly x: number; readonly y: number }
}

interface StorageActivation {
  readonly atMs: number
  readonly itemId: number
}

function InventoryActions({
  companion = false,
  economy,
  onAction,
  onClose,
  onDragChange,
  onDragMove,
  onNotice,
  onSelect,
  selection,
  showDone = true,
  storageDropRect = null,
}: {
  companion?: boolean
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose?: () => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onNotice: (notice: HubInventoryRendererNotice) => void
  onSelect: (selection: HubInventorySelectionModel | null) => void
  selection: HubInventorySelectionModel | null
  showDone?: boolean
  storageDropRect?: readonly [number, number, number, number] | null
}) {
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const pressRef = useRef<InventoryPointerPress | null>(null)
  const lastActivationRef = useRef<InventoryActivation | null>(null)

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
    const item = economy.backpack.find(({ id }) => id === source.itemId)
    if (!item) return
    if (item.nativeTypeId === 7001) {
      onAction({ type: 'consume', itemId: item.id })
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
    event.currentTarget.setPointerCapture(event.pointerId)
    const startedAtMs = performance.now()
    pressRef.current = {
      activeDrag: false,
      pointerId: event.pointerId,
      source,
      start: pointerStagePosition(event),
    }
    if (!sourceIsSelected(source)) selectSource(source, startedAtMs)
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
    const nowMs = performance.now()
    const previous = lastActivationRef.current
    if (previous && sameInventorySource(previous.source, press.source)
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs) {
      lastActivationRef.current = null
      activateSource(press.source)
    } else lastActivationRef.current = { atMs: nowMs, source: press.source }
  }

  const cancelPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pressRef.current?.pointerId !== event.pointerId) return
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

  return (
    <>
      <section aria-label="Backpack">
        {Array.from({ length: HUB_INVENTORY_GRID.capacity }, (_, index) => {
          const item = economy.backpack[index]
          if (!item) return null
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
                'data-inventory-owner': 'backpack',
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
            disabled={locked || !source}
            label={`${EQUIPMENT_SLOT_LABELS[slot]}${locked ? ', locked' : item ? `, ${item.name}` : ', empty'}`}
            rect={rect}
            onKeyDown={source ? keyboardSelect(source) : undefined}
            onPointerCancel={source ? cancelPointer : undefined}
            onPointerDown={source ? beginPointer(source) : undefined}
            onPointerMove={source ? movePointer : undefined}
            onPointerUp={source ? finishPointer : undefined}
          />
        ))
      })}
      {showDone && onClose
        ? <NativeAction label="Done" rect={[1510, 830, 85, 65]} onClick={onClose} />
        : null}
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
  readonly source: InventoryPointerSource
  readonly start: { readonly x: number; readonly y: number }
}

interface InventoryActivation {
  readonly atMs: number
  readonly source: InventoryPointerSource
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
  onNotice: (notice: HubInventoryRendererNotice) => void,
  companion: boolean,
  storageDropRect: readonly [number, number, number, number] | null,
): void {
  if (source.owner === 'backpack') {
    const item = economy.backpack.find(({ id }) => id === source.itemId)
    if (!item) return
    if (storageDropRect && pointInRect(point, storageDropRect)) {
      onAction({ type: 'transfer', direction: 'to-storage', gesture: 'drag', itemId: item.id })
      return
    }
    const slot = equipmentSlotsForItem(item, thirdRingUnlocked).find((candidate) => (
      hubInventoryEquipmentSlotRects(candidate, companion).some((rect) => pointInRect(point, rect))
    ))
    if (slot) onAction({ type: 'equip', itemId: item.id, slot })
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
  onClick,
  price,
  selected,
}: {
  data?: Record<string, number | string>
  dowsing?: boolean
  index: number
  label: string
  onClick: () => void
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
      onClick={onClick}
    >
      <span className="hub-native-ui-semantic hub-trader-price">{price.toLocaleString()}</span>
    </NativeAction>
  )
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
  label,
  onClick,
  onFocus,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  rect,
}: {
  children?: ReactNode
  data?: Record<string, number | string>
  disabled?: boolean
  label: string
  onClick?: () => void
  onFocus?: () => void
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  rect: readonly [number, number, number, number]
}) {
  return (
    <button
      type="button"
      className="hub-native-ui-action"
      aria-label={label}
      disabled={disabled}
      style={rectStyle(rect)}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerEnter={onFocus}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
