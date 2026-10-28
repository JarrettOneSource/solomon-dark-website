import type { EquipmentSlot, HubInventoryItem } from './core-kernels/hub-economy.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'

export const EQUIPMENT_SLOT_LABELS: Readonly<Record<EquipmentSlot, string>> = {
  amulet: 'Amulet',
  hat: 'Hat',
  'ring-0': 'Ring I',
  'ring-1': 'Ring II',
  'ring-2': 'Ring III',
  robe: 'Robe',
  weapon: 'Weapon',
}

export const EQUIPMENT_SLOT_ORDER: readonly EquipmentSlot[] = [
  'hat',
  'robe',
  'amulet',
  'weapon',
  'ring-0',
  'ring-1',
  'ring-2',
]

export function itemAtEquipmentSlot(economy: ProtocolPlayerEconomy, slot: EquipmentSlot): HubInventoryItem | null {
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
