import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  type HubInventoryRenderer,
  type HubInventoryRendererModel,
  type HubTraderChatPhase,
} from './renderer/hub-inventory-renderer.ts'
import {
  HUB_CHAT_PANEL,
  HUB_DOWSING_GRID,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_INVENTORY_GRID,
  HUB_NATIVE_UI_TIMING,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  hubDowsingSlotPosition,
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
}: HubInventoryUiProps) {
  const nearestTrader = useMemo(
    () => disabled || transitionActive ? null : nearestHubTrader(region, playerPosition),
    [disabled, playerPosition, region, transitionActive],
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
        audio.playSound('click')
        closeSurface()
        return
      }
      if (!surface && !disabled && !transitionActive && event.code === 'KeyI') {
        event.preventDefault()
        event.stopPropagation()
        audio.playSound('click')
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
  const [notice, setNotice] = useState<typeof HUB_DOWSING_INSUFFICIENT_GOLD | null>(null)
  const [chat, setChat] = useState<{
    acceleratedAtMs: number | null
    phase: HubTraderChatPhase
    phaseStartedAtMs: number
  }>(() => ({ acceleratedAtMs: null, phase: 'intro', phaseStartedAtMs: performance.now() }))
  const [selection, setSelection] = useState<{ id: number; owner: 'backpack' | 'storage' | null } | null>(null)

  const beginChatPhase = useCallback((phase: HubTraderChatPhase) => {
    chatCompletionHandledRef.current = false
    setChat({ acceleratedAtMs: null, phase, phaseStartedAtMs: performance.now() })
  }, [])

  const model = useMemo((): HubInventoryRendererModel => {
    if (surface.kind === 'inventory') return {
      config,
      economy,
      kind: 'inventory',
      progression,
      selectedItemId: selection?.id ?? null,
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
      economy,
      kind: 'service',
      notice,
      progression,
      selectedItemId: selection?.id ?? null,
      selectedOwner: selection?.owner ?? null,
      trader: surface.trader,
    }
  }, [chat, config, economy, notice, progression, selection, surface])

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
    if (!selection) return
    if (surface.kind === 'inventory') {
      if (!economy.backpack.some(({ id }) => id === selection.id)) setSelection(null)
      return
    }
    if (surface.kind !== 'service') return
    const present = surface.trader === 'luthacus'
      ? (selection.owner === 'backpack' ? economy.backpack : economy.storage)
        .some(({ id }) => id === selection.id)
      : surface.trader === 'fomentius'
        ? economy.fomentiusStock.some(({ id }) => id === selection.id)
        : surface.trader === 'hagatha'
          ? economy.hagathaOffers.some(({ selector }) => selector === selection.id)
          : economy.dowsingOffers.some(({ id }) => id === selection.id)
    if (!present) setSelection(null)
  }, [economy.backpack, economy.dowsingOffers, economy.fomentiusStock, economy.hagathaOffers, economy.storage, selection, surface])

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
            onClose={() => click(onClose)}
            onAccelerate={() => setChat((current) => current.acceleratedAtMs === null
              ? { ...current, acceleratedAtMs: performance.now() }
              : current)}
            onAdvance={() => click(() => beginChatPhase('choices'))}
            onPrices={() => click(() => beginChatPhase('prices'))}
            onService={() => click(() => onSurfaceChange({ kind: 'service', trader: surface.trader }))}
          />
        ) : surface.kind === 'service' ? (
          <ServiceActions
            economy={economy}
            selection={selection}
            trader={surface.trader}
            onAction={(action) => click(() => onAction(action))}
            onClose={() => click(onClose)}
            onInsufficientGold={() => click(() => setNotice(HUB_DOWSING_INSUFFICIENT_GOLD))}
            onSelect={(next) => click(() => setSelection(next))}
          />
        ) : (
          <InventoryActions
            economy={economy}
            selection={selection}
            onAction={(action) => click(() => onAction(action))}
            onClose={() => click(onClose)}
            onSelect={setSelection}
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
  onAction,
  onClose,
  onInsufficientGold,
  onSelect,
  selection,
  trader,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onInsufficientGold: () => void
  onSelect: (selection: { id: number; owner: 'backpack' | 'storage' | null } | null) => void
  selection: { id: number; owner: 'backpack' | 'storage' | null } | null
  trader: HubTraderId
}) {
  if (trader === 'luthacus') return (
    <InventoryShopActions
      economy={economy}
      selection={selection}
      onAction={onAction}
      onClose={onClose}
      onSelect={onSelect}
    />
  )
  if (trader === 'shlorio' && economy.dowsingOffers.length === 0) return (
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

  if (trader === 'hagatha') {
    return (
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
              onSelect,
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
  }

  const items = trader === 'fomentius'
    ? economy.fomentiusStock
    : dowsingItems(economy)
  return (
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
            onSelect,
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

function InventoryShopActions({
  economy,
  onAction,
  onClose,
  onSelect,
  selection,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onSelect: (selection: { id: number; owner: 'backpack' | 'storage' | null } | null) => void
  selection: { id: number; owner: 'backpack' | 'storage' | null } | null
}) {
  return (
    <>
      <SemanticInventoryCollection
        items={economy.backpack}
        label="Backpack"
        owner="backpack"
        selection={selection}
        onActivate={(item) => activateSelection(
          selection,
          { id: item.id, owner: 'backpack' },
          onSelect,
          () => onAction({ type: 'transfer', direction: 'to-storage', itemId: item.id }),
        )}
      />
      <SemanticInventoryCollection
        items={economy.storage.slice(0, 28)}
        label="Scavenged Goods"
        owner="storage"
        selection={selection}
        onActivate={(item) => activateSelection(
          selection,
          { id: item.id, owner: 'storage' },
          onSelect,
          () => onAction({ type: 'transfer', direction: 'to-backpack', itemId: item.id }),
        )}
      />
      <NativeAction label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
    </>
  )
}

function InventoryActions({
  economy,
  onAction,
  onClose,
  onSelect,
  selection,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onSelect: (selection: { id: number; owner: 'backpack' | 'storage' | null } | null) => void
  selection: { id: number; owner: 'backpack' | 'storage' | null } | null
}) {
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const selected = economy.backpack.find((item) => item.id === selection?.id) ?? null
  return (
    <>
      <section aria-label="Backpack">
        {Array.from({ length: HUB_INVENTORY_GRID.capacity }, (_, index) => {
          const item = economy.backpack[index]
          if (!item) return null
          const position = hubInventorySlotPosition(index)
          return (
            <NativeAction
              key={item.id}
              label={`${item.name}, quantity ${item.quantity}`}
              rect={[position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize]}
              onClick={() => onSelect({ id: item.id, owner: 'backpack' })}
            />
          )
        })}
      </section>
      {EQUIPMENT_SLOT_ORDER.map((slot) => {
        const item = itemAtEquipmentSlot(economy, slot)
        const locked = slot === 'ring-2' && !thirdRingUnlocked
        const rect = equipmentRect(slot)
        return (
          <NativeAction
            key={slot}
            data={{ 'data-equipment-slot': slot }}
            disabled={locked || !item}
            label={`${EQUIPMENT_SLOT_LABELS[slot]}${locked ? ', locked' : item ? `, ${item.name}` : ', empty'}`}
            rect={rect}
            onClick={() => onAction({ type: 'unequip', slot })}
          />
        )
      })}
      {selected ? equipmentSlotsForItem(selected, thirdRingUnlocked).map((slot, index) => (
        <NativeAction
          key={slot}
          label={`Equip ${EQUIPMENT_SLOT_LABELS[slot]}`}
          rect={[680 + index * 130, 425, 125, 36]}
          onClick={() => onAction({ type: 'equip', itemId: selected.id, slot })}
        />
      )) : null}
      <NativeAction label="Done" rect={[1510, 830, 85, 65]} onClick={onClose} />
    </>
  )
}

function SemanticInventoryCollection({
  items,
  label,
  onActivate,
  owner,
  selection,
}: {
  items: readonly HubInventoryItem[]
  label: string
  onActivate: (item: HubInventoryItem) => void
  owner: 'backpack' | 'storage'
  selection: { id: number; owner: 'backpack' | 'storage' | null } | null
}) {
  return (
    <section aria-label={label}>
      {items.map((item, index) => {
        const position = owner === 'backpack'
          ? hubInventorySlotPosition(index)
          : hubShopSlotPosition(index)
        const selected = selection?.id === item.id && selection.owner === owner
        return (
          <NativeAction
            key={item.id}
            data={{ 'data-selected': selected ? 'true' : 'false' }}
            label={`${item.name}, quantity ${item.quantity}`}
            rect={[
              position.x,
              position.y,
              owner === 'backpack' ? HUB_INVENTORY_GRID.cellSize : HUB_SHOP_GRID.cellSize,
              owner === 'backpack' ? HUB_INVENTORY_GRID.cellSize : HUB_SHOP_GRID.cellSize,
            ]}
            onClick={() => onActivate(item)}
          />
        )
      })}
    </section>
  )
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
  current: { id: number; owner: 'backpack' | 'storage' | null } | null,
  next: { id: number; owner: 'backpack' | 'storage' | null },
  select: (selection: { id: number; owner: 'backpack' | 'storage' | null } | null) => void,
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
  rect,
}: {
  children?: ReactNode
  data?: Record<string, number | string>
  disabled?: boolean
  label: string
  onClick: () => void
  onFocus?: () => void
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
      onPointerEnter={onFocus}
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

function equipmentRect(slot: EquipmentSlot): readonly [number, number, number, number] {
  switch (slot) {
    case 'amulet': return [1301, 170, 46, 46]
    case 'hat': return [1355, 144, 68, 68]
    case 'weapon': return [1275, 224, 68, 68]
    case 'robe': return [1355, 224, 68, 105]
    case 'ring-0': return [1301, 303, 46, 46]
    case 'ring-1': return [1435, 303, 46, 46]
    case 'ring-2': return [1435, 350, 46, 46]
  }
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
