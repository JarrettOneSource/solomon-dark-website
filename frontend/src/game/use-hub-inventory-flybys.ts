import { useCallback, useEffect, useState } from 'react'
import type { HubInventoryAction } from './core-kernels/hub-economy.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'
import type {
  HubInventoryFlybyLaneModel,
  HubInventoryFlybyModel,
} from './renderer/hub-inventory/model.ts'
import { HUB_INVENTORY_FLYBY } from './renderer/hub-inventory-render-contract.ts'
import type { InventoryMoveAction } from './hub-inventory-ui-model.ts'

export interface InventoryFlybyRequest {
  readonly action: InventoryMoveAction | null
  readonly lanes: readonly HubInventoryFlybyLaneModel[]
}

interface InventoryFlybyState extends HubInventoryFlybyModel {
  readonly action: InventoryMoveAction | null
  readonly actionDispatched: boolean
  readonly feedbackSequence: number
}

export function useHubInventoryFlybys(
  actionFeedback: ProtocolPlayerEconomy['actionFeedback'],
  onAction: (action: HubInventoryAction) => void,
  sackPath: readonly number[],
) {
  const [inventoryFlybys, setInventoryFlybys] = useState<readonly InventoryFlybyState[]>([])

  const inventoryFlyby = inventoryFlybys.find(({ phase }) => phase === 'flying') ?? null

  const startInventoryFlyby = useCallback((request: InventoryFlybyRequest) => {
    setInventoryFlybys((current) => current.some(({ phase }) => phase === 'flying')
      ? current
      : [...current, {
          ...request,
          actionDispatched: false,
          feedbackSequence: actionFeedback?.sequence ?? 0,
          phase: 'flying',
          startedAtMs: performance.now(),
        }])
  }, [actionFeedback?.sequence])

  useEffect(() => {
    if (!inventoryFlyby || inventoryFlyby.phase !== 'flying'
      || inventoryFlyby.actionDispatched) return
    const travelMs = HUB_INVENTORY_FLYBY.travelTicks * HUB_INVENTORY_FLYBY.tickMs
    const timeout = window.setTimeout(() => {
      if (inventoryFlyby.action) onAction(inventoryFlyby.action)
      setInventoryFlybys((current) => current.map((entry) => (
        entry.startedAtMs === inventoryFlyby.startedAtMs
          ? {
              ...entry,
              actionDispatched: true,
              phase: entry.action === null ? 'trailing' : 'flying',
            }
          : entry
      )))
    }, Math.max(0, inventoryFlyby.startedAtMs + travelMs - performance.now()))
    return () => window.clearTimeout(timeout)
  }, [inventoryFlyby, onAction])

  useEffect(() => {
    if (!inventoryFlyby?.action || !inventoryFlyby.actionDispatched) return
    const feedback = actionFeedback
    if (!feedback || feedback.sequence <= inventoryFlyby.feedbackSequence
      || feedback.action !== inventoryFlyby.action.type) return
    setInventoryFlybys((current) => current.map((entry) => (
      entry.startedAtMs === inventoryFlyby.startedAtMs
        ? { ...entry, phase: 'trailing' }
        : entry
    )))
  }, [actionFeedback, inventoryFlyby])

  useEffect(() => {
    const finalTick = HUB_INVENTORY_FLYBY.travelTicks - 1 + HUB_INVENTORY_FLYBY.tailTicks
    const trailing = inventoryFlybys.filter(({ phase }) => phase === 'trailing')
    if (trailing.length === 0) return
    const nextExpiry = Math.min(...trailing.map(({ startedAtMs }) => (
      startedAtMs + finalTick * HUB_INVENTORY_FLYBY.tickMs
    )))
    const timeout = window.setTimeout(() => {
      const nowMs = performance.now()
      setInventoryFlybys((current) => current.filter((entry) => (
        entry.phase !== 'trailing'
          || entry.startedAtMs + finalTick * HUB_INVENTORY_FLYBY.tickMs > nowMs
      )))
    }, Math.max(0, nextExpiry - performance.now()))
    return () => window.clearTimeout(timeout)
  }, [inventoryFlybys])
  useEffect(() => setInventoryFlybys([]), [sackPath])
  return { inventoryFlyby, inventoryFlybys, startInventoryFlyby }
}
