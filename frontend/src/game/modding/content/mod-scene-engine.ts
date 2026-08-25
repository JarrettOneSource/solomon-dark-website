import type { PreparedModContentCatalog } from './mod-content-catalog.ts'

const MAXIMUM_SCENE_STACK = 8

export interface ActiveModScene {
  readonly epoch: number
  readonly ownerId: string
  readonly parentContentId: string | null
  readonly sceneContentId: string
}

export interface ModSceneCheckpoint {
  readonly nextEpoch: number
  readonly scenes: readonly ActiveModScene[]
  readonly stacks: readonly Readonly<{ ownerId: string; sceneContentIds: readonly string[] }>[]
}

export class ModSceneEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #scenes = new Map<string, ActiveModScene>()
  readonly #stacks = new Map<string, string[]>()
  #nextEpoch = 1

  constructor(catalog: PreparedModContentCatalog) {
    this.#catalog = catalog
  }

  checkpoint(): ModSceneCheckpoint {
    return Object.freeze({
      nextEpoch: this.#nextEpoch,
      scenes: this.project(),
      stacks: Object.freeze([...this.#stacks.entries()].map(([ownerId, sceneContentIds]) => Object.freeze({
        ownerId,
        sceneContentIds: Object.freeze([...sceneContentIds]),
      }))),
    })
  }

  enter(ownerId: string, sceneContentId: string): ActiveModScene {
    const definition = this.#catalog.scene(sceneContentId)
    if (!definition) throw new Error(`mod scene is unavailable: ${sceneContentId}`)
    const active = this.#scenes.get(ownerId)
    const stack = this.#stacks.get(ownerId) ?? []
    if (active) stack.push(active.sceneContentId)
    if (stack.length > MAXIMUM_SCENE_STACK) throw new Error('mod scene stack limit reached')
    this.#stacks.set(ownerId, stack)
    const next = Object.freeze({
      epoch: this.#nextEpoch++,
      ownerId,
      parentContentId: active?.sceneContentId ?? null,
      sceneContentId,
    })
    this.#scenes.set(ownerId, next)
    return next
  }

  project(): readonly ActiveModScene[] {
    return Object.freeze([...this.#scenes.values()].sort((left, right) => (
      left.ownerId.localeCompare(right.ownerId)
    )))
  }

  restore(checkpoint: ModSceneCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.nextEpoch) || checkpoint.nextEpoch < 1) {
      throw new Error('mod scene checkpoint is invalid')
    }
    const scenes = new Map<string, ActiveModScene>()
    for (const scene of checkpoint.scenes) {
      if (scenes.has(scene.ownerId) || !this.#catalog.scene(scene.sceneContentId) ||
          !Number.isSafeInteger(scene.epoch) || scene.epoch < 1) {
        throw new Error('mod scene checkpoint contains an invalid scene')
      }
      scenes.set(scene.ownerId, Object.freeze({ ...scene }))
    }
    const stacks = new Map<string, string[]>()
    for (const stack of checkpoint.stacks) {
      if (stacks.has(stack.ownerId) || stack.sceneContentIds.length > MAXIMUM_SCENE_STACK ||
          stack.sceneContentIds.some(id => !this.#catalog.scene(id))) {
        throw new Error('mod scene checkpoint contains an invalid stack')
      }
      stacks.set(stack.ownerId, [...stack.sceneContentIds])
    }
    this.#scenes.clear()
    this.#stacks.clear()
    for (const [key, scene] of scenes) this.#scenes.set(key, scene)
    for (const [key, stack] of stacks) this.#stacks.set(key, stack)
    this.#nextEpoch = checkpoint.nextEpoch
  }

  return(ownerId: string): ActiveModScene | null {
    const stack = this.#stacks.get(ownerId)
    const parent = stack?.pop()
    if (!parent) {
      this.#scenes.delete(ownerId)
      this.#stacks.delete(ownerId)
      return null
    }
    const next = Object.freeze({
      epoch: this.#nextEpoch++,
      ownerId,
      parentContentId: stack?.at(-1) ?? null,
      sceneContentId: parent,
    })
    this.#scenes.set(ownerId, next)
    return next
  }
}
