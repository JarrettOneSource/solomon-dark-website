import type { PreparedModContentCatalog } from './mod-content-catalog.ts'

const MAXIMUM_SCENE_STACK = 8

export interface ActiveModScene {
  readonly epoch: number
  readonly ownerId: string
  readonly parentContentId: string | null
  readonly roomIndex: number
  readonly sceneContentId: string
}

export interface ModSceneCheckpoint {
  readonly nextEpoch: number
  readonly scenes: readonly ActiveModScene[]
  readonly stacks: readonly Readonly<{
    ownerId: string
    roomIndexes: readonly number[]
    sceneContentIds: readonly string[]
  }>[]
}

export class ModSceneEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #scenes = new Map<string, ActiveModScene>()
  readonly #stacks = new Map<string, Array<Readonly<{ roomIndex: number; sceneContentId: string }>>>()
  #nextEpoch = 1

  constructor(catalog: PreparedModContentCatalog) {
    this.#catalog = catalog
  }

  checkpoint(): ModSceneCheckpoint {
    return Object.freeze({
      nextEpoch: this.#nextEpoch,
      scenes: this.project(),
      stacks: Object.freeze([...this.#stacks.entries()].map(([ownerId, scenes]) => Object.freeze({
        ownerId,
        roomIndexes: Object.freeze(scenes.map(scene => scene.roomIndex)),
        sceneContentIds: Object.freeze(scenes.map(scene => scene.sceneContentId)),
      }))),
    })
  }

  enter(ownerId: string, sceneContentId: string): ActiveModScene {
    const definition = this.#catalog.scene(sceneContentId)
    if (!definition) throw new Error(`mod scene is unavailable: ${sceneContentId}`)
    const active = this.#scenes.get(ownerId)
    const stack = this.#stacks.get(ownerId) ?? []
    if (active) stack.push(Object.freeze({
      roomIndex: active.roomIndex,
      sceneContentId: active.sceneContentId,
    }))
    if (stack.length > MAXIMUM_SCENE_STACK) throw new Error('mod scene stack limit reached')
    this.#stacks.set(ownerId, stack)
    const next = Object.freeze({
      epoch: this.#nextEpoch++,
      ownerId,
      parentContentId: active?.sceneContentId ?? null,
      roomIndex: 0,
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
      const definition = this.#catalog.scene(scene.sceneContentId)
      if (scenes.has(scene.ownerId) || !definition ||
          !Number.isSafeInteger(scene.epoch) || scene.epoch < 1 ||
          !Number.isSafeInteger(scene.roomIndex) || scene.roomIndex < 0 ||
          scene.roomIndex >= definition.rooms.length) {
        throw new Error('mod scene checkpoint contains an invalid scene')
      }
      scenes.set(scene.ownerId, Object.freeze({ ...scene }))
    }
    const stacks = new Map<string, Array<Readonly<{ roomIndex: number; sceneContentId: string }>>>()
    for (const stack of checkpoint.stacks) {
      if (stacks.has(stack.ownerId) || stack.sceneContentIds.length > MAXIMUM_SCENE_STACK ||
          stack.sceneContentIds.length !== stack.roomIndexes.length ||
          stack.sceneContentIds.some((id, index) => {
            const definition = this.#catalog.scene(id)
            return !definition || !Number.isSafeInteger(stack.roomIndexes[index]) ||
              stack.roomIndexes[index]! < 0 || stack.roomIndexes[index]! >= definition.rooms.length
          })) {
        throw new Error('mod scene checkpoint contains an invalid stack')
      }
      stacks.set(stack.ownerId, stack.sceneContentIds.map((sceneContentId, index) => Object.freeze({
        roomIndex: stack.roomIndexes[index]!,
        sceneContentId,
      })))
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
      parentContentId: stack?.at(-1)?.sceneContentId ?? null,
      roomIndex: parent.roomIndex,
      sceneContentId: parent.sceneContentId,
    })
    this.#scenes.set(ownerId, next)
    return next
  }

  selectRoom(ownerId: string, roomIndex: number): ActiveModScene {
    const active = this.#scenes.get(ownerId)
    const definition = active ? this.#catalog.scene(active.sceneContentId) : null
    if (!active || !definition || !Number.isSafeInteger(roomIndex) ||
        roomIndex < 0 || roomIndex >= definition.rooms.length) {
      throw new Error('mod scene room is unavailable')
    }
    if (active.roomIndex === roomIndex) return active
    const next = Object.freeze({ ...active, epoch: this.#nextEpoch++, roomIndex })
    this.#scenes.set(ownerId, next)
    return next
  }
}
