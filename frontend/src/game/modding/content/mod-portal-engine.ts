import type { ResolvedWebLuaContentReference, WebLuaDefinitionValue } from '../definition/index.ts'
import type { PreparedModContentCatalog } from './mod-content-catalog.ts'
import { ModSceneEngine, type ActiveModScene } from './mod-scene-engine.ts'

export interface PreparedModPortal {
  readonly destination: ResolvedWebLuaContentReference
  readonly id: string
  readonly objectKind: string
  readonly policy: 'any-member' | 'leader-confirms'
  readonly prompt: string
  readonly scene: string
}

export class ModPortalEngine {
  readonly #portals: readonly PreparedModPortal[]
  readonly #scenes: ModSceneEngine

  constructor(catalog: PreparedModContentCatalog, scenes: ModSceneEngine) {
    this.#scenes = scenes
    this.#portals = Object.freeze(catalog.sceneExtensions().flatMap(extension => (
      extension.features.flatMap((feature, index): PreparedModPortal[] => {
        if (feature.operation !== 'prefab.portal') return []
        const selector = object(feature.fields.selector, `${extension.key}.features[${index}].selector`)
        const destination = reference(feature.fields.destination, `${extension.key}.features[${index}].destination`)
        if (destination.targetKind !== 'scene' || !catalog.scene(destination.contentId)) {
          throw new Error(`${extension.modId}:${extension.key} portal destination is unavailable`)
        }
        const policy = feature.fields.policy ?? 'leader_confirms'
        if (policy !== 'leader_confirms' && policy !== 'any_member') {
          throw new Error(`${extension.modId}:${extension.key} portal policy is invalid`)
        }
        return [Object.freeze({
          destination,
          id: `${extension.contentId}:${index}`,
          objectKind: text(selector.object_kind, 'portal object_kind'),
          policy: policy === 'leader_confirms' ? 'leader-confirms' as const : 'any-member' as const,
          prompt: text(feature.fields.prompt ?? 'Enter', 'portal prompt'),
          scene: extension.scene,
        })]
      })
    )))
  }

  activate(options: Readonly<{
    actorKind: string
    confirmedByLeader: boolean
    ownerId: string
    portalId: string
    scene: string
  }>): ActiveModScene {
    const portal = this.#portals.find(candidate => candidate.id === options.portalId)
    if (!portal || portal.scene !== options.scene || portal.objectKind !== options.actorKind) {
      throw new Error('mod portal is unavailable')
    }
    if (portal.policy === 'leader-confirms' && !options.confirmedByLeader) {
      throw new Error('mod portal requires leader confirmation')
    }
    return this.#scenes.enter(options.ownerId, portal.destination.contentId)
  }

  portals(): readonly PreparedModPortal[] {
    return this.#portals
  }
}

function object(value: WebLuaDefinitionValue | undefined, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`)
  return value as Readonly<Record<string, WebLuaDefinitionValue>>
}

function reference(value: WebLuaDefinitionValue | undefined, field: string): ResolvedWebLuaContentReference {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (value as { kind?: unknown }).kind !== 'resolved-content-reference') {
    throw new Error(`${field} must be a resolved reference`)
  }
  return value as unknown as ResolvedWebLuaContentReference
}

function text(value: WebLuaDefinitionValue | undefined, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) throw new Error(`${field} is invalid`)
  return value
}
