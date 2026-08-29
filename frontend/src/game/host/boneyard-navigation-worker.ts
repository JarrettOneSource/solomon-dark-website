import { parentPort } from 'node:worker_threads'

import type { BoneyardCollisionWorld } from '../core-server/boneyard-collision.ts'
import {
  buildPreparedBoneyardNavigationMesh,
  type PreparedBoneyardNavigationMesh,
} from '../core-server/boneyard-enemy-navigation.ts'
import type { BoneyardWorldNavigationPreparation } from '../core-server/boneyard-world.ts'

interface PrepareNavigationRequest {
  readonly collision: BoneyardCollisionWorld
  readonly preparations: readonly BoneyardWorldNavigationPreparation[]
  readonly type: 'prepare'
}

interface PreparedNavigationResponse {
  readonly meshes: readonly PreparedBoneyardNavigationMesh[]
  readonly type: 'prepared'
}

if (!parentPort) throw new Error('Boneyard navigation worker requires a parent port')

parentPort.once('message', (request: PrepareNavigationRequest) => {
  try {
    if (request.type !== 'prepare') throw new Error('unknown Boneyard navigation worker request')
    const response: PreparedNavigationResponse = {
      meshes: request.preparations.map(({ bounds, clearance }) => (
        buildPreparedBoneyardNavigationMesh(bounds, request.collision, clearance)
      )),
      type: 'prepared',
    }
    parentPort!.postMessage(response)
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.message : String(error),
      type: 'error',
    })
  }
})
