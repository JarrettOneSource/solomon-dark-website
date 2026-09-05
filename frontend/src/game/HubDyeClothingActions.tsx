import {
  MAX_NATIVE_DYE_SELECTIONS,
  inventoryItemsAtSackPath,
  inventoryDyeableClothingItems,
  projectInventoryRootSlots,
} from './core-kernels/hub-economy.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'
import type {
  HubInventoryDyeModalModel,
} from './renderer/hub-inventory/model.ts'
import {
  HUB_DYE_CLOTHING,
  HUB_INVENTORY_GRID,
  hubDyeItemLayerRects,
  hubDyeSwatchRect,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
} from './renderer/hub-inventory-render-contract.ts'
import { NativeAction } from './HubNativeAction.tsx'

export function DyeClothingActions({
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
