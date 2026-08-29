import { Worker } from 'node:worker_threads'

import { boneyardCollisionGeometryIdentity } from '../core-server/boneyard-collision.ts'
import {
  installPreparedBoneyardNavigationMesh,
  type PreparedBoneyardNavigationMesh,
} from '../core-server/boneyard-enemy-navigation.ts'
import {
  boneyardWorldNavigationIsPrepared,
  boneyardWorldNavigationPreparations,
  type BoneyardWorldState,
} from '../core-server/boneyard-world.ts'

const pendingPreparations = new WeakMap<object, Promise<void>>()

export function prepareBoneyardWorldNavigationAsync(
  world: BoneyardWorldState,
): Promise<void> {
  if (boneyardWorldNavigationIsPrepared(world)) return Promise.resolve()
  const identity = boneyardCollisionGeometryIdentity(world.collision)
  const pending = pendingPreparations.get(identity)
  if (pending) return pending
  const preparation = runNavigationWorker(world).finally(() => {
    pendingPreparations.delete(identity)
  })
  pendingPreparations.set(identity, preparation)
  return preparation
}

async function runNavigationWorker(world: BoneyardWorldState): Promise<void> {
  const workerModule = import.meta.url.endsWith('.ts')
    ? './boneyard-navigation-worker.ts'
    : './boneyard-navigation-worker.mjs'
  const worker = new Worker(new URL(workerModule, import.meta.url), {
    execArgv: workerModule.endsWith('.ts')
      && !process.execArgv.includes('--experimental-strip-types')
      ? [...process.execArgv, '--experimental-strip-types']
      : process.execArgv,
  })
  try {
    const meshes = await new Promise<readonly PreparedBoneyardNavigationMesh[]>(
      (resolve, reject) => {
        let settled = false
        const fail = (error: Error) => {
          if (settled) return
          settled = true
          reject(error)
        }
        worker.once('error', fail)
        worker.once('exit', (code) => {
          if (!settled) fail(new Error(
            `Boneyard navigation worker exited before responding with code ${code}`,
          ))
        })
        worker.once('message', (response: Readonly<Record<string, unknown>>) => {
          if (settled) return
          settled = true
          if (response.type === 'error') {
            reject(new Error(String(response.error)))
            return
          }
          if (response.type !== 'prepared' || !Array.isArray(response.meshes)) {
            reject(new Error('Boneyard navigation worker returned an invalid response'))
            return
          }
          resolve(response.meshes as readonly PreparedBoneyardNavigationMesh[])
        })
        worker.postMessage({
          collision: world.collision,
          preparations: boneyardWorldNavigationPreparations(world),
          type: 'prepare',
        })
      },
    )
    for (const prepared of meshes) {
      installPreparedBoneyardNavigationMesh(world.collision, prepared)
    }
    if (!boneyardWorldNavigationIsPrepared(world)) {
      throw new Error('Boneyard navigation worker omitted a required mesh')
    }
  } finally {
    await worker.terminate()
  }
}
