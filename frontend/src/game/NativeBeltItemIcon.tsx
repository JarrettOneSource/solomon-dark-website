import type { CSSProperties } from 'react'

import {
  DOWSING_EQUIPMENT_RECIPES,
  type HubInventoryItem,
} from './core-kernels/hub-economy.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import {
  HUB_ITEM_ICON_TRANSFORMS,
  HUB_STARTER_EQUIPMENT_PRIMARY_TINT,
} from './renderer/hub-inventory-render-contract.ts'
import { NativeUiSprite } from './native-ui/react-raw.ts'

export default function NativeBeltItemIcon({
  element,
  item,
}: {
  readonly element: WizardElement
  readonly item: HubInventoryItem
}) {
  const transform = item.equipmentType === null
    ? null
    : HUB_ITEM_ICON_TRANSFORMS[item.equipmentType]
  const recipe = item.recipeIndex === null
    ? null
    : DOWSING_EQUIPMENT_RECIPES[item.recipeIndex]
  const iconTints = item.equipmentType === 'hat' || item.equipmentType === 'robe'
    ? item.iconTints
      ?? recipe?.iconTints
      ?? [HUB_STARTER_EQUIPMENT_PRIMARY_TINT[element], 0xffffff]
    : [null, null]
  return (
    <span className="hub-hud-belt-item-icon" data-native-item-id={item.id}>
      {item.iconRecords.map((record, index) => (
        <NativeUiSprite
          atlas="Inventory"
          className="hub-hud-belt-item-layer"
          key={`${record}:${index}`}
          maskTint={iconTints[index] ?? undefined}
          record={record}
          style={{
            '--native-item-rotation': `${transform?.rotationDegrees ?? 0}deg`,
            '--native-item-x': `${transform?.translation[0] ?? 0}px`,
            '--native-item-y': `${transform?.translation[1] ?? 0}px`,
          } as CSSProperties}
        />
      ))}
      {item.quantity > 1 ? (
        <span className="hub-hud-belt-item-count">{item.quantity}</span>
      ) : null}
    </span>
  )
}
