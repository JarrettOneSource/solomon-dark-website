import type { BoastSelection, ModBoastSelection } from '../../core-kernels/boast.ts'
import type { ModConsumableCatalogEntry } from '../../core-kernels/hub-economy.ts'
import {
  type GameModAsset,
  MOD_CONTENT_KINDS,
  type ModBoastIconProjection,
  type ModContentKind,
  type ModContentProjection,
} from '../game-mod-contract.ts'
import type { GameContentManifest } from '../game-protocol-contract.ts'
import { MAX_CONTENT_MODS } from '../game-protocol-limits.ts'
import { modConsumableContent, modSpriteFrame } from './items.ts'
import {
  GameProtocolError,
  boolean,
  boundedInteger,
  boundedString,
  finite,
  finiteWithin,
  integerWithin,
  limitedArray,
  limitedString,
  nonnegativeInteger,
  onlyKeys,
  positiveInteger,
  record,
  sha256,
  validatedPlayerId,
} from './values.ts'

export function boastSelection(value: unknown, field: string): BoastSelection {
  if (typeof value === 'number') {
    return integerWithin(value, field, 0, 4) as 0 | 1 | 2 | 3 | 4
  }
  const source = record(value, field)
  onlyKeys(source, field, ['contentId', 'kind', 'modId'])
  const selection: ModBoastSelection = {
    contentId: limitedString(source.contentId, `${field}.contentId`, 19),
    kind: limitedString(source.kind, `${field}.kind`, 8) as 'mod',
    modId: limitedString(source.modId, `${field}.modId`, 128),
  }
  if (
    selection.kind !== 'mod'
    || !/^[1-9][0-9]{0,18}$/.test(selection.contentId)
    || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(selection.modId)
  ) throw new GameProtocolError(`${field} is not a valid Boast selection`)
  return selection
}

export function contentManifest(value: unknown): GameContentManifest {
  const source = record(value, 'content')
  return {
    manifestSha256: sha256(source.manifestSha256, 'content.manifestSha256'),
    mods: limitedArray(source.mods, 'content.mods', MAX_CONTENT_MODS).map(
      (entry, index) => {
        const mod = record(entry, `content.mods[${index}]`)
        return {
          id: limitedString(mod.id, `content.mods[${index}].id`, 128),
          version: limitedString(mod.version, `content.mods[${index}].version`, 64),
          contentSha256: sha256(
            mod.contentSha256,
            `content.mods[${index}].contentSha256`,
          ),
        }
      },
    ),
  }
}

export function gameModAssets(value: unknown): readonly GameModAsset[] {
  const seen = new Set<string>()
  return limitedArray(value, 'modAssets', 8_192).map((value, index) => {
    const field = `modAssets[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, ['byteLength', 'contentType', 'kind', 'modId', 'path', 'sha256'])
    const contentType = limitedString(source.contentType, `${field}.contentType`, 128)
    const kind = limitedString(source.kind, `${field}.kind`, 64)
    const modId = limitedString(source.modId, `${field}.modId`, 128)
    const path = limitedString(source.path, `${field}.path`, 240)
    const byteLength = integerWithin(
      source.byteLength,
      `${field}.byteLength`,
      1,
      16 * 1024 * 1024,
    )
    const key = `${modId.toLowerCase()}\0${path.toLowerCase()}`
    if (
      !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(modId)
      || !/^(?:sprites|art|audio|levels|scenes)\/.+\.(?:boneyard|bundle|json|mp3|ogg|png|wav)$/.test(path)
      || seen.has(key)
    ) throw new GameProtocolError(`${field} is not a bounded unique typed asset`)
    seen.add(key)
    return {
      byteLength,
      contentType,
      kind,
      modId,
      path,
      sha256: sha256(source.sha256, `${field}.sha256`),
    }
  })
}

export function modContentProjection(value: Record<string, unknown>): ModContentProjection {
  const contentIds = new Set<string>()
  const contentKinds = new Map<string, ModContentKind>()
  const content = limitedArray(value.content, 'content', 4_096).map((value, index) => {
    const field = `content[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, [
      'art', 'contentId', 'contentKind', 'description', 'key', 'modId', 'name', 'presentation',
    ])
    const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
    const contentKind = limitedString(source.contentKind, `${field}.contentKind`, 32)
    const modId = limitedString(source.modId, `${field}.modId`, 128)
    const key = limitedString(source.key, `${field}.key`, 128)
    if (
      !/^[1-9][0-9]{0,18}$/.test(contentId)
      || !(MOD_CONTENT_KINDS as readonly string[]).includes(contentKind)
      || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(modId)
      || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(key)
      || contentIds.has(contentId)
    ) throw new GameProtocolError(`${field} is invalid`)
    contentIds.add(contentId)
    contentKinds.set(contentId, contentKind as ModContentKind)
    const slots = new Set<string>()
    const art = limitedArray(source.art, `${field}.art`, 32).map((value, artIndex) => {
      const artField = `${field}.art[${artIndex}]`
      const art = record(value, artField)
      onlyKeys(art, artField, ['path', 'slot'])
      const slot = limitedString(art.slot, `${artField}.slot`, 64)
      const path = limitedString(art.path, `${artField}.path`, 240)
      if (slots.has(slot) || !/^(?:art|audio|levels|scenes|sprites)\/.+/.test(path)) {
        throw new GameProtocolError(`${artField} is invalid`)
      }
      slots.add(slot)
      return {
        path,
        slot,
      }
    })
    return {
      art,
      contentId,
      contentKind: contentKind as ModContentKind,
      description: boundedString(source.description, `${field}.description`, 1_024),
      key,
      modId,
      name: limitedString(source.name, `${field}.name`, 128),
      presentation: source.presentation === null
        ? null
        : limitedString(source.presentation, `${field}.presentation`, 64),
    }
  })
  const byContentId = new Map(content.map(entry => [entry.contentId, entry]))
  const boastContentIds = new Set<string>()
  const failureProducers = new Set([
    'magical-equipment', 'mana-underflow', 'potion-use', 'secondary-cast',
  ])
  const boasts = limitedArray(value.boasts, 'boasts', 4_096).map((value, index) => {
    const field = `boasts[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, [
      'contentId', 'failureProducers', 'icon', 'instruction', 'modId', 'name',
      'randomSkillChoices', 'response', 'scoreMultiplier', 'statement', 'successWave',
    ])
    const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
    const contentEntry = byContentId.get(contentId)
    const modId = limitedString(source.modId, `${field}.modId`, 128)
    const name = limitedString(source.name, `${field}.name`, 128)
    if (
      contentEntry?.contentKind !== 'boast'
      || contentEntry.modId !== modId
      || contentEntry.name !== name
      || boastContentIds.has(contentId)
    ) throw new GameProtocolError(`${field} does not match its Boast content entry`)
    boastContentIds.add(contentId)
    const producers = limitedArray(source.failureProducers, `${field}.failureProducers`, 4)
      .map((value, producerIndex) => limitedString(
        value,
        `${field}.failureProducers[${producerIndex}]`,
        32,
      ))
    if (
      producers.some(producer => !failureProducers.has(producer))
      || new Set(producers).size !== producers.length
    ) throw new GameProtocolError(`${field}.failureProducers is invalid`)
    const iconSource = record(source.icon, `${field}.icon`)
    const kind = limitedString(iconSource.kind, `${field}.icon.kind`, 8)
    const icon: ModBoastIconProjection = kind === 'stock'
      ? (() => {
          onlyKeys(iconSource, `${field}.icon`, ['kind', 'record', 'style'])
          const style = boundedInteger(iconSource.style, `${field}.icon.style`, 0, 7)
          const record = boundedInteger(iconSource.record, `${field}.icon.record`, 90, 97)
          if (
            record !== 90 + style
            || contentEntry.art.some(art => art.slot === 'icon')
          ) throw new GameProtocolError(`${field}.icon is inconsistent`)
          return { kind: 'stock' as const, record, style }
        })()
      : kind === 'mod'
        ? (() => {
            onlyKeys(iconSource, `${field}.icon`, [
              'frame', 'imageHeight', 'imagePath', 'imageWidth', 'kind',
            ])
            const frame = modSpriteFrame(iconSource.frame, `${field}.icon.frame`)
            const imageWidth = boundedInteger(
              iconSource.imageWidth,
              `${field}.icon.imageWidth`,
              1,
              4_096,
            )
            const imageHeight = boundedInteger(
              iconSource.imageHeight,
              `${field}.icon.imageHeight`,
              1,
              4_096,
            )
            if (
              frame.logicalWidth > 128
              || frame.logicalHeight > 128
              || frame.x + frame.width > imageWidth
              || frame.y + frame.height > imageHeight
              || !contentEntry.art.some(art => (
                art.slot === 'icon' && art.path === iconSource.imagePath
              ))
            ) {
              throw new GameProtocolError(`${field}.icon is inconsistent`)
            }
            return {
              frame,
              imageHeight,
              imagePath: limitedString(iconSource.imagePath, `${field}.icon.imagePath`, 240),
              imageWidth,
              kind: 'mod' as const,
            }
          })()
        : (() => { throw new GameProtocolError(`${field}.icon.kind is invalid`) })()
    return {
      contentId,
      failureProducers: producers,
      icon,
      instruction: boundedString(source.instruction, `${field}.instruction`, 1_024),
      modId,
      name,
      randomSkillChoices: boolean(source.randomSkillChoices, `${field}.randomSkillChoices`),
      response: boundedString(source.response, `${field}.response`, 1_024),
      scoreMultiplier: finiteWithin(source.scoreMultiplier, `${field}.scoreMultiplier`, 1, 10),
      statement: boundedString(source.statement, `${field}.statement`, 1_024),
      successWave: boundedInteger(source.successWave, `${field}.successWave`, 1, 10_000),
    }
  })
  const instanceIds = new Set<number>()
  const powerups = limitedArray(value.powerups, 'powerups', 1_024).map((value, index) => {
    const field = `powerups[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, ['contentId', 'id', 'spawnedTick', 'x', 'y'])
    const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
    const id = positiveInteger(source.id, `${field}.id`)
    if (contentKinds.get(contentId) !== 'powerup' || instanceIds.has(id)) {
      throw new GameProtocolError(`${field} is invalid`)
    }
    instanceIds.add(id)
    return {
      contentId,
      id,
      spawnedTick: nonnegativeInteger(source.spawnedTick, `${field}.spawnedTick`),
      x: finite(source.x, `${field}.x`),
      y: finite(source.y, `${field}.y`),
    }
  })
  instanceIds.clear()
  const statuses = limitedArray(value.statuses, 'statuses', 4_096).map((value, index) => {
    const field = `statuses[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, [
      'contentId', 'expiresTick', 'instanceId', 'startedTick', 'targetId',
    ])
    const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
    const instanceId = positiveInteger(source.instanceId, `${field}.instanceId`)
    const startedTick = nonnegativeInteger(source.startedTick, `${field}.startedTick`)
    const expiresTick = positiveInteger(source.expiresTick, `${field}.expiresTick`)
    if (!contentIds.has(contentId) || instanceIds.has(instanceId) || expiresTick <= startedTick) {
      throw new GameProtocolError(`${field} is invalid`)
    }
    instanceIds.add(instanceId)
    return {
      contentId,
      expiresTick,
      instanceId,
      startedTick,
      targetId: validatedPlayerId(source.targetId, `${field}.targetId`),
    }
  })
  return {
    boasts,
    content,
    manifestSha256: sha256(value.manifestSha256, 'manifestSha256'),
    powerups,
    revision: nonnegativeInteger(value.revision, 'revision'),
    statuses,
  }
}

export function modConsumableCatalog(
  value: unknown,
  field: string,
): readonly ModConsumableCatalogEntry[] {
  const ids = new Set<string>()
  return limitedArray(value, field, 256).map((value, index) => {
    const itemField = `${field}[${index}]`
    const source = record(value, itemField)
    onlyKeys(source, itemField, ['content', 'name', 'nativeSubtype'])
    const content = modConsumableContent(source.content, `${itemField}.content`)
    if (ids.has(content.contentId)) {
      throw new GameProtocolError(`${field} duplicates content id ${content.contentId}`)
    }
    ids.add(content.contentId)
    return {
      content,
      name: limitedString(source.name, `${itemField}.name`, 128),
      nativeSubtype: boundedInteger(
        source.nativeSubtype,
        `${itemField}.nativeSubtype`,
        6,
        261,
      ),
    }
  })
}
