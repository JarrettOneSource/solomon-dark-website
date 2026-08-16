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
} from './renderer/hub-inventory-renderer.ts'
import {
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_GRID,
  HUB_INVENTORY_GRID,
  HUB_NATIVE_UI_TIMING,
  HUB_SHOP_GRID,
  hubInventorySlotPosition,
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
  const [rendererState, setRendererState] = useState<'error' | 'loading' | 'ready'>('loading')
  const [notice, setNotice] = useState<typeof HUB_DOWSING_INSUFFICIENT_GOLD | null>(null)
  const [showPriceExplanation, setShowPriceExplanation] = useState(false)
  const [page, setPage] = useState(0)
  const [selection, setSelection] = useState<{ id: number; owner: 'backpack' | 'storage' | null } | null>(null)

  const model = useMemo((): HubInventoryRendererModel => {
    if (surface.kind === 'inventory') return {
      config,
      economy,
      kind: 'inventory',
      progression,
      selectedItemId: selection?.id ?? null,
    }
    if (surface.kind === 'dialogue') return {
      kind: 'dialogue',
      priceExplanation: showPriceExplanation,
      trader: surface.trader,
    }
    return {
      economy,
      kind: 'service',
      notice,
      page,
      selectedItemId: selection?.id ?? null,
      selectedOwner: selection?.owner ?? null,
      trader: surface.trader,
    }
  }, [config, economy, notice, page, progression, selection, showPriceExplanation, surface])

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
        ? HUB_NATIVE_UI_TIMING.messageBoxRevealPerTick
        : HUB_NATIVE_UI_TIMING.inventoryRevealPerTick
      renderer.render(nowMs, Math.min(1, ticks * step))
    })
    return () => {
      disposed = true
      unsubscribe()
      rendererRef.current = null
      renderer?.destroy()
      host.replaceChildren()
    }
  }, [surface.kind])

  useEffect(() => {
    if (!selection) return
    if (surface.kind === 'inventory') {
      if (!economy.backpack.some(({ id }) => id === selection.id)) setSelection(null)
      return
    }
    if (surface.kind !== 'service' || surface.trader !== 'luthacus') return
    const items = selection.owner === 'backpack' ? economy.backpack : economy.storage
    if (!items.some(({ id }) => id === selection.id)) setSelection(null)
  }, [economy.backpack, economy.storage, selection, surface])

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
              rect={[690, 510, 220, 56]}
              onClick={() => click(() => setNotice(null))}
            />
          </>
        ) : surface.kind === 'dialogue' ? (
          <DialogueActions
            priceExplanation={showPriceExplanation}
            trader={surface.trader}
            onClose={() => click(onClose)}
            onPrices={() => click(() => setShowPriceExplanation(true))}
            onService={() => click(() => onSurfaceChange({ kind: 'service', trader: surface.trader }))}
          />
        ) : surface.kind === 'service' ? (
          <ServiceActions
            economy={economy}
            page={page}
            selection={selection}
            trader={surface.trader}
            onAction={(action) => click(() => onAction(action))}
            onClose={() => click(onClose)}
            onInsufficientGold={() => click(() => setNotice(HUB_DOWSING_INSUFFICIENT_GOLD))}
            onPage={(next) => click(() => {
              setPage(next)
              setSelection(null)
            })}
            onSelect={setSelection}
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
  onClose,
  onPrices,
  onService,
  priceExplanation,
  trader,
}: {
  onClose: () => void
  onPrices: () => void
  onService: () => void
  priceExplanation: boolean
  trader: HubTraderId
}) {
  const dialogue = HUB_TRADER_DIALOGUES[trader]
  return (
    <div className="hub-native-dialogue-actions">
      <div className="hub-native-ui-semantic">
        {(priceExplanation ? dialogue.priceExplanation : dialogue.intro).map((line) => <p key={line}>{line}</p>)}
      </div>
      {priceExplanation ? (
        <NativeAction label="Done" rect={[690, 650, 220, 56]} onClick={onClose} />
      ) : (
        <>
          <NativeAction data={{ 'data-service-trader': trader }} label={dialogue.actionLabel} rect={[410, 650, 240, 56]} onClick={onService} />
          {dialogue.priceExplanation.length > 0 ? (
            <NativeAction label="Your Prices" rect={[680, 650, 240, 56]} onClick={onPrices} />
          ) : null}
          <NativeAction label="Goodbye" rect={[950, 650, 240, 56]} onClick={onClose} />
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
  onPage,
  onSelect,
  page,
  selection,
  trader,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onInsufficientGold: () => void
  onPage: (page: number) => void
  onSelect: (selection: { id: number; owner: 'backpack' | 'storage' | null } | null) => void
  page: number
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
        rect={[680, 275, 240, 64]}
        onClick={() => economy.gold < economy.dowsingFee
          ? onInsufficientGold()
          : onAction({ type: 'dowse' })}
      />
      <NativeAction label="Done" rect={[1027, 400, 120, 48]} onClick={onClose} />
    </>
  )

  if (trader === 'hagatha') {
    const pageSize = HUB_SHOP_GRID.pageSize
    const visible = economy.hagathaOffers.slice(page * pageSize, (page + 1) * pageSize)
    const pages = Math.max(1, Math.ceil(economy.hagathaOffers.length / pageSize))
    return (
      <>
        {visible.map((offer, index) => (
          <ShopAction
            key={offer.selector}
            index={index}
            columns={4}
            disabled={economy.gold < offer.price}
            label={`Buy ${offer.name} for ${offer.price} gold`}
            data={{ 'data-hagatha-selector': offer.selector }}
            price={offer.price}
            onFocus={() => onSelect({ id: offer.selector, owner: null })}
            onClick={() => onAction({ type: 'buy-hagatha', selector: offer.selector })}
          />
        ))}
        <span className="hub-native-ui-semantic hub-charm-capacity">
          Charms and curses: {economy.ownedPerkSelectors.length} / {economy.charmCapacity}
        </span>
        <PageActions page={page} pages={pages} onPage={onPage} />
        <NativeAction label="Done" rect={[1027, 400, 120, 48]} onClick={onClose} />
      </>
    )
  }

  const items = trader === 'fomentius'
    ? economy.fomentiusStock
    : dowsingItems(economy)
  const pageSize = trader === 'shlorio' ? HUB_DOWSING_GRID.pageSize : HUB_SHOP_GRID.pageSize
  const columns = trader === 'shlorio' ? 3 : 4
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const visible = items.slice(page * pageSize, (page + 1) * pageSize)
  return (
    <>
      {visible.map((item, index) => (
        <ShopAction
          key={item.id}
          columns={columns}
          data={{ 'data-item-id': item.id }}
          disabled={economy.gold < item.price}
          index={index}
          label={`Buy ${item.name} for ${item.price} gold`}
          price={item.price}
          onFocus={() => onSelect({ id: item.id, owner: null })}
          onClick={() => onAction(trader === 'fomentius'
            ? { type: 'buy-fomentius', itemId: item.id }
            : { type: 'buy-dowsing', offerId: item.id })}
        />
      ))}
      <PageActions page={page} pages={pages} onPage={onPage} />
      <NativeAction label="Done" rect={[1027, 400, 120, 48]} onClick={onClose} />
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
  const selectedItems = selection?.owner === 'backpack' ? economy.backpack : economy.storage
  const selected = selectedItems.find((item) => item.id === selection?.id)
  return (
    <>
      <SemanticInventoryCollection
        items={economy.backpack.slice(0, 28)}
        label="Backpack"
        left={230}
        top={190}
        onSelect={(item) => onSelect({ id: item.id, owner: 'backpack' })}
      />
      <SemanticInventoryCollection
        items={economy.storage.slice(0, 28)}
        label="Scavenged Goods"
        left={890}
        top={190}
        onSelect={(item) => onSelect({ id: item.id, owner: 'storage' })}
      />
      {selection && selected ? (
        <NativeAction
          label={selection.owner === 'backpack' ? 'Store' : 'Take'}
          rect={[680, 695, 240, 54]}
          onClick={() => onAction({
            type: 'transfer',
            direction: selection.owner === 'backpack' ? 'to-storage' : 'to-backpack',
            itemId: selection.id,
          })}
        />
      ) : null}
      <NativeAction label="Done" rect={[1290, 780, 125, 48]} onClick={onClose} />
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
  left,
  onSelect,
  top,
}: {
  items: readonly HubInventoryItem[]
  label: string
  left: number
  onSelect: (item: HubInventoryItem) => void
  top: number
}) {
  return (
    <section aria-label={label}>
      {items.map((item, index) => (
        <NativeAction
          key={item.id}
          label={`${item.name}, quantity ${item.quantity}`}
          rect={[left + (index % 7) * 76, top + Math.floor(index / 7) * 76, 68, 68]}
          onClick={() => onSelect(item)}
        />
      ))}
    </section>
  )
}

function ShopAction({
  columns,
  data,
  disabled,
  index,
  label,
  onClick,
  onFocus,
  price,
}: {
  columns: number
  data?: Record<string, number | string>
  disabled: boolean
  index: number
  label: string
  onClick: () => void
  onFocus: () => void
  price: number
}) {
  const pitch = columns === 3 ? 150 : 135
  const centerLeft = 800 - ((columns - 1) * pitch) / 2
  const x = centerLeft + (index % columns) * pitch - 40
  const y = 80 + Math.floor(index / columns) * 112
  return (
    <NativeAction data={data} disabled={disabled} label={label} rect={[x, y, 80, 100]} onClick={onClick} onFocus={onFocus}>
      <span className="hub-native-ui-semantic hub-trader-price">{price.toLocaleString()}</span>
    </NativeAction>
  )
}

function PageActions({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null
  return (
    <>
      <NativeAction disabled={page === 0} label="Previous page" rect={[690, 360, 90, 46]} onClick={() => onPage(page - 1)} />
      <NativeAction disabled={page >= pages - 1} label="Next page" rect={[820, 360, 90, 46]} onClick={() => onPage(page + 1)} />
    </>
  )
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
