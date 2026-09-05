import { dowsingItems } from './hub-inventory-service-presentation.ts'
import { activateSelection } from './hub-inventory-pointer.ts'
import type { ReactNode } from 'react'
import {
  HAGATHA_PERKS,
  type HubInventoryAction,
  type HubTraderId,
} from './core-kernels/hub-economy.ts'
import type { NativeHudRect } from './native-hud-layout.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'
import type {
  HubInventoryDragModel,
  HubInventoryPressedControl,
  HubInventorySelectionModel,
  HubServiceInspectionModel,
} from './renderer/hub-inventory/model.ts'
import {
  HUB_DOWSING_PREROLL,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  hubHagathaOfferSlotPosition,
  hubOwnedPerkSlotRect,
} from './renderer/hub-inventory-render-contract.ts'
import type { HubServiceSelection } from './hub-inventory-ui-model.ts'
import type { InventoryFlybyRequest } from './use-hub-inventory-flybys.ts'
import { InventoryActions } from './HubInventoryActions.tsx'
import { NativeAction } from './HubNativeAction.tsx'
import { ShopAction, EmptyStoreGridActions } from './HubStoreGridActions.tsx'
import { InventoryShopStorageActions } from './HubStorageActions.tsx'
import type { HubInventoryUiNotice } from './hub-inventory-notices.ts'

export function ServiceActions({
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
            position={hubHagathaOfferSlotPosition(index)}
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
          positionAt={hubHagathaOfferSlotPosition}
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
