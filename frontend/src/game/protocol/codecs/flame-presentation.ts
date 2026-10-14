import { nativeFlameFadeAlpha } from '../../core-kernels/native-weld-flame-state.ts'
import type { NativeFlameFadeBirth } from '../../core-kernels/native-weld-flame-state.ts'
import type { FlamePresentationFrame, FlamePresentationRecipe } from '../flame-presentation.ts'
import { MAX_PRIMARY_SPELL_TRANSIENTS } from '../game-protocol-limits.ts'
import { flameChannelVisual, flameFadePayload } from './weld-flame.ts'
import { nativeWorldManagerRegistration } from './native-state.ts'
import { GameProtocolError, boolean, limitedArray, limitedString, nonnegativeInteger, onlyKeys, positiveInteger, record, validatedPlayerId } from './values.ts'

export function flamePresentationFrame(value: unknown, field: string, worldKey: string, worldTick: number, nextPrimaryId: number): FlamePresentationFrame {
  const source = record(value, field)
  if (source.kind !== 'reset' && source.kind !== 'continuous') throw new GameProtocolError(`${field}.kind is not a Flame history frame`)
  onlyKeys(source, field, source.kind === 'reset'
    ? ['kind', 'epoch', 'worldKey', 'throughTick', 'births']
    : ['kind', 'epoch', 'worldKey', 'throughTick', 'afterTick', 'births'])
  const epoch = safeTick(source.epoch, `${field}.epoch`, true)
  const throughTick = safeTick(source.throughTick, `${field}.throughTick`)
  if (source.worldKey !== worldKey || throughTick !== worldTick) throw new GameProtocolError(`${field} does not match the stopped snapshot world`)
  const rawBirths = limitedArray(source.births, `${field}.births`, MAX_PRIMARY_SPELL_TRANSIENTS)
  if (source.kind === 'reset') {
    if (rawBirths.length !== 0) throw new GameProtocolError(`${field} cannot replay births across a reset`)
    return { kind: 'reset', epoch, worldKey, throughTick, births: [] }
  }
  const afterTick = safeTick(source.afterTick, `${field}.afterTick`)
  if (afterTick > throughTick) throw new GameProtocolError(`${field} has a reversed coverage interval`)
  const identities = new Set<string>()
  const births = rawBirths.map((value, index) => {
    const name = `${field}.births[${index}]`, birth = record(value, name)
    onlyKeys(birth, name, ['id', 'kind', 'ownerId', 'worldKey', 'birthTick', 'endTickExclusive', 'recipe'])
    const id = safeTick(birth.id, `${name}.id`, true)
    if (id >= nextPrimaryId) throw new GameProtocolError(`${name}.id is not allocated`)
    const ownerId = validatedPlayerId(birth.ownerId, `${name}.ownerId`)
    const actorWorldKey = limitedString(birth.worldKey, `${name}.worldKey`, 256)
    if (actorWorldKey !== worldKey && !(worldKey === 'hub' && actorWorldKey.startsWith('hub:'))) throw new GameProtocolError(`${name} belongs to another world`)
    const birthTick = safeTick(birth.birthTick, `${name}.birthTick`)
    const endTickExclusive = safeTick(birth.endTickExclusive, `${name}.endTickExclusive`)
    const recipe = flameRecipe(birth.recipe, `${name}.recipe`, birthTick)
    if (birth.kind !== recipe.kind) throw new GameProtocolError(`${name}.kind does not match its recipe`)
    let lifetime = 1
    if (recipe.kind === 'fade') {
      lifetime = 0
      while (nativeFlameFadeAlpha(recipe.birth.birthAlpha, recipe.alphaStep, lifetime) > 0) lifetime += 1
    }
    if (birthTick > throughTick || endTickExclusive < birthTick || endTickExclusive > birthTick + lifetime
      || (birthTick <= afterTick && endTickExclusive <= afterTick)) throw new GameProtocolError(`${name} exceeds its native presentation interval`)
    const identity = String(id)
    if (identities.has(identity)) throw new GameProtocolError(`${field} repeats a birth identity`)
    identities.add(identity)
    return { id, kind: recipe.kind, ownerId, worldKey: actorWorldKey, birthTick, endTickExclusive, recipe }
  })
  return { kind: 'continuous', epoch, worldKey, throughTick, afterTick, births }
}

function flameRecipe(value: unknown, field: string, birthTick: number): FlamePresentationRecipe {
  const source = record(value, field)
  if (source.kind === 'ribbon') {
    onlyKeys(source, field, ['kind', 'birth', 'enhancedEffects', 'weak', 'painterRegistration'])
    const enhancedEffects = boolean(source.enhancedEffects, `${field}.enhancedEffects`)
    const weak = boolean(source.weak, `${field}.weak`)
    const birth = flameChannelVisual(source.birth, `${field}.birth`, { birthTick, enhancedEffects, underpowered: weak })
    if (birth.kind !== 'native-birth-v1') throw new GameProtocolError(`${field} cannot replay a suppressed legacy ribbon`)
    const painterRegistration = nativeWorldManagerRegistration(source.painterRegistration, `${field}.painterRegistration`, 'actor')
    safeTick(painterRegistration.registrationOrdinal, `${field}.painterRegistration.registrationOrdinal`)
    return { kind: 'ribbon', birth, enhancedEffects, weak, painterRegistration }
  }
  if (source.kind !== 'fade') throw new GameProtocolError(`${field}.kind is not a Flame recipe`)
  onlyKeys(source, field, ['kind', 'birth', 'position', 'alphaStep', 'baseScale', 'wrapperScalar', 'variant', 'painterRegistration'])
  const birth = record(source.birth, `${field}.birth`)
  if (birth.kind !== 'native-birth-v1' || (birth.birthAlpha !== .5 && birth.birthAlpha !== 1)) throw new GameProtocolError(`${field} cannot replay an incomplete fade`)
  const painterRegistration = nativeWorldManagerRegistration(source.painterRegistration, `${field}.painterRegistration`, 'transient')
  safeTick(painterRegistration.registrationOrdinal, `${field}.painterRegistration.registrationOrdinal`)
  const decoded = flameFadePayload({ ...source, flameVisual: birth,
    alpha: nativeFlameFadeAlpha(birth.birthAlpha, Number(source.alphaStep), 0), record: 35,
    colorGreen: source.variant === 'source' ? 1 : .75, rotationDegrees: 0,
    lightRegistration: source.variant === 'source' ? null : painterRegistration }, field, 0)
  return { kind: 'fade', birth: decoded.flameVisual as NativeFlameFadeBirth,
    position: decoded.position, alphaStep: decoded.alphaStep, baseScale: decoded.baseScale,
    wrapperScalar: decoded.wrapperScalar, variant: decoded.variant, painterRegistration }
}

function safeTick(value: unknown, field: string, positive = false): number {
  const result = positive ? positiveInteger(value, field) : nonnegativeInteger(value, field)
  if (!Number.isSafeInteger(result)) throw new GameProtocolError(`${field} must be a safe integer`)
  return result
}
