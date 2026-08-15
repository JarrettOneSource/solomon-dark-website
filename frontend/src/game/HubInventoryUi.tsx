import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import nativeAssetsJson from '../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import { hub } from '../lib/assets.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  type EquipmentSlot,
  type HagathaOffer,
  type HubInventoryAction,
  type HubInventoryItem,
  type HubShopItem,
  type HubTraderId,
} from './core-kernels/hub-economy.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import {
  HUB_TRADER_DIALOGUES,
  HUB_TRADER_GRID_CAPACITY,
  equipmentSlotsForItem,
  hubTraderWithinServiceRange,
  nearestHubTrader,
} from './hub-inventory-presentation.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'
import './hub-inventory.css'

type AtlasName = 'Inventory' | 'Skills' | 'UI'
interface AtlasRecord {
  frame: readonly [number, number, number, number]
  logicalSize: readonly [number, number]
  trimOrigin: readonly [number, number]
}
interface NativeAssetManifest {
  atlases: Record<AtlasName, {
    file: string
    records: Record<string, AtlasRecord>
  }>
  schema: string
  sourceExecutableSha256: string
}

const nativeAssets = nativeAssetsJson as unknown as NativeAssetManifest
const ATLAS_SOURCE: Readonly<Record<AtlasName, string>> = {
  Inventory: hub.trader.inventoryAtlas,
  Skills: hub.trader.skillsAtlas,
  UI: hub.trader.uiAtlas,
}
const ATLAS_SIZE: Readonly<Record<AtlasName, readonly [number, number]>> = {
  Inventory: [1024, 512],
  Skills: [1024, 512],
  UI: [1024, 1024],
}
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
  disabled: boolean
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onSurfaceChange: (surface: HubUiSurface) => void
  playerPosition: Vector2
  region: HubRegionId
  surface: HubUiSurface
  transitionActive: boolean
}

export default function HubInventoryUi({
  disabled,
  economy,
  onAction,
  onSurfaceChange,
  playerPosition,
  region,
  surface,
  transitionActive,
}: HubInventoryUiProps) {
  const [showPriceExplanation, setShowPriceExplanation] = useState(false)
  const surfaceTrader = surface && 'trader' in surface ? surface.trader : null
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
    setShowPriceExplanation(false)
  }, [surface?.kind, surfaceTrader])

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
      onSurfaceChange({ kind: 'dialogue', trader: nearestTrader })
    }
    window.addEventListener('keydown', keyDown, { capture: true })
    return () => window.removeEventListener('keydown', keyDown, { capture: true })
  }, [closeSurface, disabled, nearestTrader, onSurfaceChange, surface, transitionActive])

  return (
    <>
      {!surface && nearestTrader ? (
        <button
          type="button"
          className="hub-trader-interact"
          data-hub-trader={nearestTrader}
          onClick={() => onSurfaceChange({ kind: 'dialogue', trader: nearestTrader })}
        >
          <span className="hub-trader-interact-key">E</span>
          Talk to {HUB_TRADER_DIALOGUES[nearestTrader].name}
        </button>
      ) : null}

      {surface?.kind === 'dialogue' ? (
        <TraderDialogue
          showPriceExplanation={showPriceExplanation}
          trader={surface.trader}
          onClose={closeSurface}
          onPrices={() => setShowPriceExplanation(true)}
          onService={() => onSurfaceChange({ kind: 'service', trader: surface.trader })}
        />
      ) : null}

      {surface?.kind === 'service' ? (
        <TraderService
          economy={economy}
          onAction={onAction}
          onClose={closeSurface}
          trader={surface.trader}
        />
      ) : null}

      {surface?.kind === 'inventory' ? (
        <InventoryScreen
          economy={economy}
          onAction={onAction}
          onClose={closeSurface}
        />
      ) : null}
    </>
  )
}

function TraderDialogue({
  onClose,
  onPrices,
  onService,
  showPriceExplanation,
  trader,
}: {
  onClose: () => void
  onPrices: () => void
  onService: () => void
  showPriceExplanation: boolean
  trader: HubTraderId
}) {
  const dialogue = HUB_TRADER_DIALOGUES[trader]
  return (
    <ModalFrame
      className="hub-trader-dialogue"
      label={`Talking to ${dialogue.name}`}
      onClose={onClose}
      title={dialogue.name}
    >
      <div className="hub-trader-dialogue-copy">
        {(showPriceExplanation ? dialogue.priceExplanation : dialogue.intro).map((paragraph) => (
          <NativeDialogueParagraph key={paragraph} text={paragraph} />
        ))}
      </div>
      <div className="hub-trader-dialogue-actions">
        {showPriceExplanation ? (
          <button type="button" onClick={() => onClose()}>Done</button>
        ) : (
          <>
            <button type="button" data-service-trader={trader} onClick={onService}>
              {dialogue.actionLabel}
            </button>
            {dialogue.priceExplanation.length > 0 ? (
              <button type="button" onClick={onPrices}>Your Prices</button>
            ) : null}
            <button type="button" onClick={onClose}>Goodbye</button>
          </>
        )}
      </div>
    </ModalFrame>
  )
}

function TraderService({
  economy,
  onAction,
  onClose,
  trader,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  trader: HubTraderId
}) {
  const dialogue = HUB_TRADER_DIALOGUES[trader]
  return (
    <ModalFrame
      className={`hub-trader-service hub-trader-service-${trader}`}
      label={dialogue.title}
      onClose={onClose}
      title={dialogue.title}
      wide
    >
      <GoldLedger gold={economy.gold} />
      {trader === 'fomentius' ? (
        <FomentiusShop economy={economy} onAction={onAction} />
      ) : trader === 'hagatha' ? (
        <HagathaShop economy={economy} onAction={onAction} />
      ) : trader === 'luthacus' ? (
        <InventoryContents economy={economy} onAction={onAction} storage />
      ) : (
        <ShlorioShop economy={economy} onAction={onAction} />
      )}
      <button type="button" className="hub-trader-done" onClick={onClose}>Done</button>
    </ModalFrame>
  )
}

function FomentiusShop({
  economy,
  onAction,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
}) {
  return (
    <PaddedGrid capacity={HUB_TRADER_GRID_CAPACITY.fomentius} columns={4}>
      {economy.fomentiusStock.map((item) => (
        <ShopCell
          key={item.id}
          disabled={economy.gold < item.price}
          item={item}
          onClick={() => onAction({ type: 'buy-fomentius', itemId: item.id })}
        />
      ))}
    </PaddedGrid>
  )
}

function HagathaShop({
  economy,
  onAction,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
}) {
  return (
    <div className="hub-hagatha-layout">
      <NativeAtlasSprite atlas="Skills" record={4} className="hub-trader-scroll-art" />
      <div className="hub-hagatha-offers">
        {economy.hagathaOffers.map((offer) => (
          <button
            key={offer.selector}
            type="button"
            className="hub-hagatha-offer"
            disabled={economy.gold < offer.price}
            data-hagatha-selector={offer.selector}
            onClick={() => onAction({ type: 'buy-hagatha', selector: offer.selector })}
          >
            <PerkIcon offer={offer} />
            <span className="hub-hagatha-copy">
              <strong>{offer.name}</strong>
              <small>{offer.description}</small>
            </span>
            <span className="hub-trader-price">{offer.price.toLocaleString()} gold</span>
          </button>
        ))}
      </div>
      <p className="hub-charm-capacity">
        Charms and curses: {economy.ownedPerkSelectors.length} / {economy.charmCapacity}
      </p>
    </div>
  )
}

function ShlorioShop({
  economy,
  onAction,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
}) {
  if (economy.dowsingOffers.length === 0) {
    return (
      <div className="hub-dowsing-start">
        <NativeAtlasSprite atlas="UI" record={15} className="hub-dowsing-button-art" />
        <button
          type="button"
          className="hub-dowse-action"
          disabled={economy.gold < economy.dowsingFee}
          onClick={() => onAction({ type: 'dowse' })}
        >
          <strong>DOWSE</strong>
          <span>{economy.dowsingFee.toLocaleString()} gold</span>
        </button>
      </div>
    )
  }
  const cells = economy.dowsingOffers.map((offer) => {
    const recipe = DOWSING_EQUIPMENT_RECIPES[offer.recipeIndex]!
    const item: HubShopItem = {
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
    return (
      <ShopCell
        key={offer.id}
        disabled={economy.gold < offer.price}
        item={item}
        onClick={() => onAction({ type: 'buy-dowsing', offerId: offer.id })}
      />
    )
  })
  return (
    <PaddedGrid capacity={HUB_TRADER_GRID_CAPACITY.shlorio} columns={3}>
      {cells}
    </PaddedGrid>
  )
}

function InventoryScreen({
  economy,
  onAction,
  onClose,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
}) {
  return (
    <ModalFrame className="hub-inventory-screen" label="Inventory" onClose={onClose} title="INVENTORY" wide>
      <GoldLedger gold={economy.gold} />
      <InventoryContents economy={economy} onAction={onAction} />
      <button type="button" className="hub-trader-done" onClick={onClose}>Done</button>
    </ModalFrame>
  )
}

function InventoryContents({
  economy,
  onAction,
  storage = false,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  storage?: boolean
}) {
  const [selection, setSelection] = useState<{
    item: HubInventoryItem
    owner: 'backpack' | 'storage'
  } | null>(null)
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  useEffect(() => {
    if (!selection) return
    const items = selection.owner === 'backpack' ? economy.backpack : economy.storage
    if (!items.some(({ id }) => id === selection.item.id)) setSelection(null)
  }, [economy.backpack, economy.storage, selection])

  return (
    <div className={`hub-inventory-layout${storage ? ' hub-inventory-layout-storage' : ''}`}>
      <InventoryNativeBackdrop />
      <section className="hub-equipment" aria-label="Equipped items">
        <h3>Equipped</h3>
        <div className="hub-equipment-slots">
          {EQUIPMENT_SLOT_ORDER.map((slot) => {
            const item = itemAtEquipmentSlot(economy, slot)
            const locked = slot === 'ring-2' && !thirdRingUnlocked
            return (
              <button
                key={slot}
                type="button"
                className="hub-equipment-slot"
                disabled={locked || !item}
                aria-label={`${EQUIPMENT_SLOT_LABELS[slot]}${locked ? ', locked' : item ? `, ${item.name}` : ', empty'}`}
                data-equipment-slot={slot}
                onClick={() => onAction({ type: 'unequip', slot })}
              >
                <span>{EQUIPMENT_SLOT_LABELS[slot]}</span>
                {item ? <HubItemIcon item={item} /> : <small>{locked ? 'Locked' : 'Empty'}</small>}
              </button>
            )
          })}
        </div>
      </section>

      <InventoryCollection
        items={economy.backpack}
        label="Backpack"
        onSelect={(item) => setSelection({ item, owner: 'backpack' })}
        selectedId={selection?.owner === 'backpack' ? selection.item.id : null}
      />
      {storage ? (
        <InventoryCollection
          items={economy.storage}
          label="Scavenged Goods"
          onSelect={(item) => setSelection({ item, owner: 'storage' })}
          selectedId={selection?.owner === 'storage' ? selection.item.id : null}
        />
      ) : null}

      <div className="hub-inventory-selection" aria-live="polite">
        {selection ? (
          <>
            <strong>{selection.item.name}</strong>
            <span>{selection.item.rarity ?? selection.item.kind.replaceAll('-', ' ')}</span>
            <div>
              {selection.owner === 'backpack'
                ? equipmentSlotsForItem(selection.item, thirdRingUnlocked).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onAction({ type: 'equip', itemId: selection.item.id, slot })}
                    >
                      Equip {EQUIPMENT_SLOT_LABELS[slot]}
                    </button>
                  ))
                : null}
              {storage ? (
                <button
                  type="button"
                  onClick={() => onAction({
                    type: 'transfer',
                    direction: selection.owner === 'backpack' ? 'to-storage' : 'to-backpack',
                    itemId: selection.item.id,
                  })}
                >
                  {selection.owner === 'backpack' ? 'Store' : 'Take'}
                </button>
              ) : null}
            </div>
          </>
        ) : <span>Select an item</span>}
      </div>
    </div>
  )
}

function InventoryCollection({
  items,
  label,
  onSelect,
  selectedId,
}: {
  items: readonly HubInventoryItem[]
  label: string
  onSelect: (item: HubInventoryItem) => void
  selectedId: number | null
}) {
  const cells: Array<HubInventoryItem | null> = [...items]
  while (cells.length < 28) cells.push(null)
  return (
    <section className="hub-inventory-collection" aria-label={label}>
      <h3>{label}</h3>
      <div className="hub-inventory-grid">
        {cells.slice(0, 28).map((item, index) => (
          <button
            key={item?.id ?? `empty-${index}`}
            type="button"
            className="hub-inventory-cell"
            disabled={!item}
            aria-label={item ? `${item.name}, quantity ${item.quantity}` : 'Empty inventory slot'}
            aria-pressed={item ? selectedId === item.id : undefined}
            onClick={() => item && onSelect(item)}
          >
            <NativeAtlasSprite atlas="Inventory" record={1} className="hub-inventory-slot-art" />
            {item ? <HubItemIcon item={item} /> : null}
            {item && item.quantity > 1 ? <span className="hub-item-quantity">{item.quantity}</span> : null}
          </button>
        ))}
      </div>
    </section>
  )
}

function PaddedGrid({
  capacity,
  children,
  columns,
}: {
  capacity: number
  children: ReactNode
  columns: number
}) {
  const entries = Array.isArray(children) ? children : [children]
  const padded = [...entries]
  while (padded.length < capacity) padded.push(null)
  return (
    <div
      className="hub-shop-grid"
      data-capacity={capacity}
      style={{ '--hub-shop-columns': columns } as CSSProperties}
    >
      {padded.slice(0, capacity).map((child, index) => child ?? (
        <div key={`empty-${index}`} className="hub-shop-cell hub-shop-cell-empty" aria-hidden>
          <NativeAtlasSprite atlas="Inventory" record={1} />
        </div>
      ))}
    </div>
  )
}

function ShopCell({
  disabled,
  item,
  onClick,
}: {
  disabled: boolean
  item: HubShopItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="hub-shop-cell"
      disabled={disabled}
      aria-label={`Buy ${item.name} for ${item.price} gold`}
      data-item-id={item.id}
      onClick={onClick}
    >
      <NativeAtlasSprite atlas="Inventory" record={1} className="hub-shop-slot-art" />
      <HubItemIcon item={item} />
      <span className="hub-shop-item-name">{item.name}</span>
      <span className="hub-trader-price">{item.price.toLocaleString()}</span>
    </button>
  )
}

function PerkIcon({ offer }: { offer: HagathaOffer }) {
  if (offer.selector === -1) {
    return <NativeAtlasSprite atlas="Inventory" record={10} fit={54} className="hub-perk-icon" />
  }
  return <NativeAtlasSprite atlas="Skills" record={127 + offer.selector} fit={54} className="hub-perk-icon" />
}

function HubItemIcon({ item }: { item: Pick<HubInventoryItem, 'iconRecords' | 'name'> }) {
  const records = item.iconRecords.map((record) => nativeRecord('Inventory', record))
  const maximumExtent = Math.max(1, ...records.flatMap(({ logicalSize }) => logicalSize))
  const scale = Math.min(1, 52 / maximumExtent)
  return (
    <span className="hub-item-icon" aria-hidden title={item.name}>
      {item.iconRecords.map((record) => (
        <NativeAtlasSprite key={record} atlas="Inventory" record={record} scale={scale} />
      ))}
    </span>
  )
}

function GoldLedger({ gold }: { gold: number }) {
  return (
    <div className="hub-gold-ledger" aria-label={`${gold} gold`} data-player-gold={gold}>
      <NativeAtlasSprite atlas="UI" record={21} fit={48} className="hub-gold-stack" />
      <strong>{gold.toLocaleString()}</strong>
      <small>gold</small>
    </div>
  )
}

function ModalFrame({
  children,
  className,
  label,
  onClose,
  title,
  wide = false,
}: {
  children: ReactNode
  className: string
  label: string
  onClose: () => void
  title: string
  wide?: boolean
}) {
  return (
    <div className="hub-trader-backdrop" role="presentation">
      <section
        className={`hub-trader-panel ${wide ? 'hub-trader-panel-wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-native-ui-schema={nativeAssets.schema}
        data-source-executable={nativeAssets.sourceExecutableSha256}
      >
        <NativeAtlasSprite atlas="UI" record={49} className="hub-trader-leather" />
        <h2>{title}</h2>
        <button type="button" className="hub-trader-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="hub-trader-panel-content">{children}</div>
      </section>
    </div>
  )
}

function NativeDialogueParagraph({ text }: { text: string }) {
  const emphasis = text.includes('very legal')
    ? 'very legal'
    : text.includes('less work')
      ? 'less'
      : null
  if (!emphasis) return <p>{text}</p>
  const [before, after] = text.split(emphasis)
  return <p>{before}<em>{emphasis}</em>{after}</p>
}

function InventoryNativeBackdrop() {
  return (
    <div className="hub-inventory-native-backdrop" aria-hidden>
      <NativeAtlasSprite atlas="UI" record={30} className="hub-inventory-stone" />
      <NativeAtlasSprite atlas="UI" record={31} className="hub-inventory-guardian" />
      <NativeAtlasSprite atlas="UI" record={33} className="hub-inventory-filigree" />
      <NativeAtlasSprite atlas="UI" record={62} className="hub-inventory-circle" />
      <NativeAtlasSprite atlas="UI" record={20} className="hub-inventory-health-plaque" />
      <NativeAtlasSprite atlas="UI" record={75} className="hub-inventory-equipment-mark hub-inventory-equipment-mark-cross" />
      <NativeAtlasSprite atlas="UI" record={76} className="hub-inventory-equipment-mark hub-inventory-equipment-mark-anvil" />
      <NativeAtlasSprite atlas="UI" record={77} className="hub-inventory-equipment-mark hub-inventory-equipment-mark-fire" />
    </div>
  )
}

function NativeAtlasSprite({
  atlas,
  className = '',
  fit,
  record,
  scale: requestedScale = 1,
}: {
  atlas: AtlasName
  className?: string
  fit?: number
  record: number
  scale?: number
}) {
  const definition = nativeRecord(atlas, record)
  const [logicalWidth, logicalHeight] = definition.logicalSize
  const scale = fit === undefined
    ? requestedScale
    : Math.min(requestedScale, fit / Math.max(logicalWidth, logicalHeight))
  const [atlasWidth, atlasHeight] = ATLAS_SIZE[atlas]
  const [x, y] = definition.frame
  const [trimX, trimY] = definition.trimOrigin
  return (
    <span
      className={`hub-native-atlas-sprite ${className}`}
      data-atlas={atlas}
      data-record={record}
      style={{
        backgroundImage: `url("${ATLAS_SOURCE[atlas]}")`,
        backgroundPosition: `${(trimX - x) * scale}px ${(trimY - y) * scale}px`,
        backgroundSize: `${atlasWidth * scale}px ${atlasHeight * scale}px`,
        height: logicalHeight * scale,
        width: logicalWidth * scale,
      }}
      aria-hidden
    />
  )
}

function nativeRecord(atlas: AtlasName, record: number): AtlasRecord {
  const definition = nativeAssets.atlases[atlas].records[`${record}`]
  if (!definition) throw new Error(`Missing native ${atlas} record ${record}`)
  return definition
}

function itemAtEquipmentSlot(
  economy: ProtocolPlayerEconomy,
  slot: EquipmentSlot,
): HubInventoryItem | null {
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
