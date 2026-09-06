import { NATIVE_HALL_OF_FAME_SCORE } from '../../core-kernels/hall-of-fame-score.ts'
import {
  HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID,
  HUB_MEMORIAL_INITIAL_MARKERS,
  HUB_MEMORIAL_INITIAL_SLOT_AGES,
  HUB_MEMORIAL_LAST_EXTERNAL_PORTRAIT_ID,
  HUB_MEMORIAL_SLOT_COUNT,
  type HubMemorialState,
} from '../../core-kernels/hub-memorial.ts'
import {
  type HubRegionId,
  isHubRegionId,
  isHubTransitionEdge,
} from '../../core-kernels/hub-regions.ts'
import type {
  NativeCollegeIntroPhase,
  NativeCollegeIntroState,
} from '../../core-kernels/native-college-intro.ts'
import type {
  PlayerLivingEquipmentAppearance,
} from '../../core-kernels/player-equipment-appearance.ts'
import {
  MAX_FOUNTAIN_PARTICLES,
  MAX_PLAYERS,
  MAX_STUDENTS,
  MAX_STUDENT_PROPS,
} from '../game-protocol-limits.ts'
import {
  HUB_PLAYER_ACTIVITIES,
  type HubPlayerActivity,
  type HubWorldSnapshot,
  type ProtocolAmbientState,
  type ProtocolHubParticipantState,
  type ProtocolHubSkorchaState,
  type ProtocolPlayerEconomy,
  type ProtocolStudentState,
} from '../game-state.ts'
import { playerCharacterConfig } from './input.ts'
import { boastSelection } from './mod-content.ts'
import { nativeWorldManagerRegistration, vector } from './native-state.ts'
import {
  GameProtocolError,
  array,
  boolean,
  finite,
  integer,
  integerWithin,
  limitedArray,
  limitedString,
  memberString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
  validatedPlayerId,
} from './values.ts'

export function nativeHubNpcState(
  value: unknown,
  field: string,
): ProtocolPlayerEconomy['npc'] {
  const source = record(value, field)
  onlyKeys(source, field, ['boast', 'helpFlags', 'librarianLaceRead'])
  const rawBoast = record(source.boast, `${field}.boast`)
  onlyKeys(rawBoast, `${field}.boast`, [
    'failed',
    'failureSequence',
    'selected',
    'succeeded',
  ])
  const selected = rawBoast.selected === null
    ? null
    : boastSelection(rawBoast.selected, `${field}.boast.selected`)
  const failed = boolean(rawBoast.failed, `${field}.boast.failed`)
  const succeeded = boolean(rawBoast.succeeded, `${field}.boast.succeeded`)
  const failureSequence = nonnegativeInteger(
    rawBoast.failureSequence,
    `${field}.boast.failureSequence`,
  )
  const helpFlags = limitedArray(source.helpFlags, `${field}.helpFlags`, 10)
    .map((value, index) => boolean(value, `${field}.helpFlags[${index}]`))
  if (
    failureSequence > 1
    || failed !== (failureSequence === 1)
    || failed && succeeded
    || selected === 3 && failed
    || selected === null && (failed || succeeded)
    || helpFlags.length !== 10
  ) throw new GameProtocolError(`${field}.boast state is inconsistent`)
  return {
    boast: { failed, failureSequence, selected, succeeded },
    helpFlags,
    librarianLaceRead: boolean(source.librarianLaceRead, `${field}.librarianLaceRead`),
  }
}

function studentState(value: unknown, field: string): ProtocolStudentState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'framePhase',
    'gaitDegrees',
    'heading',
    'headingIndex',
    'id',
    'painterRegistration',
    'position',
    'props',
    'reading',
    'scale',
  ])
  const props = limitedArray(
    source.props,
    `${field}.props`,
    MAX_STUDENT_PROPS,
  ).map((entry, index) => {
    const prop = record(entry, `${field}.props[${index}]`)
    return {
      angle: finite(prop.angle, `${field}.props[${index}].angle`),
      paletteIndex: nonnegativeInteger(
        prop.paletteIndex,
        `${field}.props[${index}].paletteIndex`,
      ),
      radius: finite(prop.radius, `${field}.props[${index}].radius`),
    }
  })
  return {
    framePhase: finite(source.framePhase, `${field}.framePhase`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    heading: finite(source.heading, `${field}.heading`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    id: nonnegativeInteger(source.id, `${field}.id`),
    painterRegistration: nativeWorldManagerRegistration(
      source.painterRegistration,
      `${field}.painterRegistration`,
      'actor',
    ),
    position: vector(source.position, `${field}.position`),
    props,
    reading: boolean(source.reading, `${field}.reading`),
    scale: positiveFinite(source.scale, `${field}.scale`),
  }
}

export function ambientState(value: unknown, field: string): ProtocolAmbientState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'fountainParticles',
    'nextFountainParticleId',
    'rngState',
    'sealCorePhase',
    'sealGlyphPhase',
    'statuePhaseDegrees',
    'teacherTick',
    'teacherWorldRelease',
  ])
  const teacherWorldRelease = source.teacherWorldRelease === null
    ? null
    : (() => {
        const release = record(source.teacherWorldRelease, `${field}.teacherWorldRelease`)
        onlyKeys(release, `${field}.teacherWorldRelease`, [
          'painterRegistrations',
          'releaseIndex',
        ])
        const painterRegistrations = limitedArray(
          release.painterRegistrations,
          `${field}.teacherWorldRelease.painterRegistrations`,
          2,
        ).map((registration, index) => nativeWorldManagerRegistration(
          registration,
          `${field}.teacherWorldRelease.painterRegistrations[${index}]`,
          'transient',
        ))
        if (painterRegistrations.length !== 2) {
          throw new GameProtocolError(
            `${field}.teacherWorldRelease.painterRegistrations must contain two roots`,
          )
        }
        return {
          painterRegistrations,
          releaseIndex: nonnegativeInteger(
            release.releaseIndex,
            `${field}.teacherWorldRelease.releaseIndex`,
          ),
        }
      })()
  return {
    fountainParticles: limitedArray(
      source.fountainParticles,
      `${field}.fountainParticles`,
      MAX_FOUNTAIN_PARTICLES,
    ).map((entry, index) => {
      const particle = record(entry, `${field}.fountainParticles[${index}]`)
      return {
        id: nonnegativeInteger(particle.id, `${field}.fountainParticles[${index}].id`),
        remaining: finite(
          particle.remaining,
          `${field}.fountainParticles[${index}].remaining`,
        ),
        scale: positiveFinite(
          particle.scale,
          `${field}.fountainParticles[${index}].scale`,
        ),
      }
    }),
    nextFountainParticleId: nonnegativeInteger(
      source.nextFountainParticleId,
      `${field}.nextFountainParticleId`,
    ),
    rngState: nonnegativeInteger(source.rngState, `${field}.rngState`),
    sealCorePhase: finite(source.sealCorePhase, `${field}.sealCorePhase`),
    sealGlyphPhase: finite(source.sealGlyphPhase, `${field}.sealGlyphPhase`),
    statuePhaseDegrees: finite(source.statuePhaseDegrees, `${field}.statuePhaseDegrees`),
    teacherTick: nonnegativeInteger(source.teacherTick, `${field}.teacherTick`),
    teacherWorldRelease,
  }
}

export function hubWorldSnapshot(value: unknown, field: string): HubWorldSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ambient',
    'collisionRngState',
    'kind',
    'memorial',
    'participants',
    'skorcha',
    'students',
    'traderAnimationSeed',
  ])
  if (source.kind !== 'hub') throw new GameProtocolError(`${field}.kind is not supported`)
  const rawParticipants = record(source.participants, `${field}.participants`)
  if (Object.keys(rawParticipants).length > MAX_PLAYERS) {
    throw new GameProtocolError(
      `${field}.participants may contain at most ${MAX_PLAYERS} entries`,
    )
  }
  const participants: Record<string, ProtocolHubParticipantState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawParticipants)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} participant id`)
    participants[playerId] = hubParticipantState(
      state,
      `${field}.participants.${playerId}`,
    )
  }
  return {
    ambient: ambientState(source.ambient, `${field}.ambient`),
    collisionRngState: nonnegativeInteger(
      source.collisionRngState,
      `${field}.collisionRngState`,
    ),
    kind: 'hub',
    memorial: decodeHubMemorialState(source.memorial, `${field}.memorial`),
    participants,
    skorcha: hubSkorchaState(source.skorcha, `${field}.skorcha`),
    students: limitedArray(source.students, `${field}.students`, MAX_STUDENTS).map(
      (student, index) => studentState(student, `${field}.students[${index}]`),
    ),
    traderAnimationSeed: nonnegativeInteger(
      source.traderAnimationSeed,
      `${field}.traderAnimationSeed`,
    ),
  }
}

export function decodeHubMemorialState(
  value: unknown,
  field = 'memorial',
): HubMemorialState {
  const source = record(value, field)
  onlyKeys(source, field, ['nextAge', 'nextPortraitId', 'slots'])
  const nextAge = positiveInteger(source.nextAge, `${field}.nextAge`)
  const nextPortraitId = integerWithin(
    source.nextPortraitId,
    `${field}.nextPortraitId`,
    HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID,
    HUB_MEMORIAL_LAST_EXTERNAL_PORTRAIT_ID,
  )
  const rawSlots = array(source.slots, `${field}.slots`)
  if (rawSlots.length !== HUB_MEMORIAL_SLOT_COUNT) {
    throw new GameProtocolError(`${field}.slots must contain ten Painting slots`)
  }
  const identities = new Set<string>()
  const portraitIds = new Set<number>()
  const ages = new Set<number>()
  const slots = rawSlots.map((value, index) => {
    const slotField = `${field}.slots[${index}]`
    const slot = record(value, slotField)
    onlyKeys(slot, slotField, ['age', 'marker', 'portrait', 'portraitId'])
    const age = nonnegativeInteger(slot.age, `${slotField}.age`)
    if (ages.has(age)) throw new GameProtocolError(`${field}.slots duplicates age ${age}`)
    ages.add(age)
    const marker = boolean(slot.marker, `${slotField}.marker`)
    const portraitId = nonnegativeInteger(slot.portraitId, `${slotField}.portraitId`)
    if (slot.portrait === null) {
      if (
        portraitId !== index
        || age !== HUB_MEMORIAL_INITIAL_SLOT_AGES[index]
        || marker !== HUB_MEMORIAL_INITIAL_MARKERS[index]
      ) throw new GameProtocolError(`${slotField} does not match its stock resident`)
      return { age, marker, portrait: null, portraitId }
    }
    if (
      portraitId < HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID
      || portraitId > HUB_MEMORIAL_LAST_EXTERNAL_PORTRAIT_ID
      || portraitIds.has(portraitId)
    ) throw new GameProtocolError(`${slotField}.portraitId is not a unique external id`)
    portraitIds.add(portraitId)
    const portraitField = `${slotField}.portrait`
    const portrait = record(slot.portrait, portraitField)
    onlyKeys(portrait, portraitField, [
      'accountUsername',
      'awesomeness',
      'awesomestKill',
      'capturedAtTick',
      'config',
      'elapsedTicks',
      'equipment',
      'headingIndex',
      'level',
      'monstersKilled',
      'playerId',
      'portraitScale',
      'runId',
      'wave',
    ])
    const playerId = validatedPlayerId(portrait.playerId, `${portraitField}.playerId`)
    const runId = limitedString(portrait.runId, `${portraitField}.runId`, 128)
    const identity = `${runId}\0${playerId}`
    if (identities.has(identity)) {
      throw new GameProtocolError(`${field}.slots duplicates a completed run participant`)
    }
    identities.add(identity)
    const portraitScale = positiveFinite(
      portrait.portraitScale,
      `${portraitField}.portraitScale`,
    )
    if (
      portraitScale < NATIVE_HALL_OF_FAME_SCORE.portraitScaleBase
      || portraitScale > 1
    ) throw new GameProtocolError(`${portraitField}.portraitScale is outside its native range`)
    return {
      age,
      marker,
      portrait: {
        accountUsername: portrait.accountUsername === null
          ? null
          : limitedString(portrait.accountUsername, `${portraitField}.accountUsername`, 64),
        awesomeness: integerWithin(
          portrait.awesomeness,
          `${portraitField}.awesomeness`,
          0,
          2_000_000_000,
        ),
        awesomestKill: portrait.awesomestKill === null
          ? null
          : limitedString(portrait.awesomestKill, `${portraitField}.awesomestKill`, 64),
        capturedAtTick: nonnegativeInteger(
          portrait.capturedAtTick,
          `${portraitField}.capturedAtTick`,
        ),
        config: playerCharacterConfig(portrait.config, `${portraitField}.config`),
        elapsedTicks: integerWithin(
          portrait.elapsedTicks,
          `${portraitField}.elapsedTicks`,
          0,
          60_480_000,
        ),
        equipment: hubMemorialEquipmentAppearance(
          portrait.equipment,
          `${portraitField}.equipment`,
        ),
        headingIndex: integerWithin(
          portrait.headingIndex,
          `${portraitField}.headingIndex`,
          0,
          23,
        ),
        level: integerWithin(portrait.level, `${portraitField}.level`, 1, 10_000),
        monstersKilled: integerWithin(
          portrait.monstersKilled,
          `${portraitField}.monstersKilled`,
          0,
          2_000_000_000,
        ),
        playerId,
        portraitScale,
        runId,
        wave: integerWithin(portrait.wave, `${portraitField}.wave`, 0, 1_000_000),
      },
      portraitId,
    }
  })
  const completionCount = nextAge - 1001
  if (completionCount < 0) throw new GameProtocolError(`${field}.nextAge precedes stock defaults`)
  const dynamicSlots = slots.filter(({ portrait }) => portrait !== null)
  if (dynamicSlots.length !== Math.min(completionCount, HUB_MEMORIAL_SLOT_COUNT)) {
    throw new GameProtocolError(`${field}.slots do not match the portrait age counter`)
  }
  const expectedAges = Array.from(
    { length: dynamicSlots.length },
    (_, index) => nextAge - dynamicSlots.length + index,
  )
  const dynamicAges = dynamicSlots.map(({ age }) => age).sort((left, right) => left - right)
  if (dynamicAges.some((age, index) => age !== expectedAges[index])) {
    throw new GameProtocolError(`${field}.slots do not retain the newest FIFO ages`)
  }
  const expectedPortraitId = HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID
    + completionCount % HUB_MEMORIAL_SLOT_COUNT
  if (nextPortraitId !== expectedPortraitId) {
    throw new GameProtocolError(`${field}.nextPortraitId does not match the ten-id ring`)
  }
  return { nextAge, nextPortraitId, slots }
}

function hubMemorialEquipmentAppearance(
  value: unknown,
  field: string,
): PlayerLivingEquipmentAppearance {
  const source = record(value, field)
  onlyKeys(source, field, ['hat', 'robe', 'weapon'])
  return {
    hat: source.hat === null ? null : hubMemorialTintedSelector(source.hat, `${field}.hat`, 3),
    robe: source.robe === null ? null : hubMemorialTintedSelector(source.robe, `${field}.robe`, 2),
    weapon: source.weapon === null
      ? null
      : (() => {
          const weapon = record(source.weapon, `${field}.weapon`)
          onlyKeys(weapon, `${field}.weapon`, ['kind', 'selector'])
          const kind = limitedString(weapon.kind, `${field}.weapon.kind`, 8)
          if (kind !== 'staff' && kind !== 'wand') {
            throw new GameProtocolError(`${field}.weapon.kind is not supported`)
          }
          return {
            kind,
            selector: integerWithin(
              weapon.selector,
              `${field}.weapon.selector`,
              0,
              5,
            ),
          }
        })(),
  }
}

function hubMemorialTintedSelector(
  value: unknown,
  field: string,
  maximumSelector: number,
) {
  const source = record(value, field)
  onlyKeys(source, field, ['primaryTint', 'secondaryTint', 'selector'])
  return {
    primaryTint: integerWithin(source.primaryTint, `${field}.primaryTint`, 0, 0xffffff),
    secondaryTint: integerWithin(source.secondaryTint, `${field}.secondaryTint`, 0, 0xffffff),
    selector: integerWithin(source.selector, `${field}.selector`, 0, maximumSelector),
  }
}

export function hubParticipantState(value: unknown, field: string): ProtocolHubParticipantState {
  const source = record(value, field)
  onlyKeys(source, field, ['activity', 'collegeIntro', 'region', 'transition'])
  const activity = source.activity === null
    ? null
    : hubPlayerActivity(source.activity, `${field}.activity`)
  const region = hubRegionId(source.region, `${field}.region`)
  const collegeIntro = source.collegeIntro === null
    ? null
    : hubCollegeIntroState(source.collegeIntro, `${field}.collegeIntro`, region)
  if (source.transition === null) return { activity, collegeIntro, region, transition: null }
  const transition = record(source.transition, `${field}.transition`)
  onlyKeys(transition, `${field}.transition`, [
    'alpha',
    'destination',
    'phase',
    'scriptedSpeed',
    'scriptedTarget',
    'sourceRegion',
  ])
  const alpha = finite(transition.alpha, `${field}.transition.alpha`)
  if (alpha < 0 || alpha > 1) {
    throw new GameProtocolError(`${field}.transition.alpha must be within [0,1]`)
  }
  if (
    transition.phase !== 'college-intro'
    && transition.phase !== 'college-loadout'
    && transition.phase !== 'outgoing'
    && transition.phase !== 'incoming'
  ) {
    throw new GameProtocolError(`${field}.transition.phase is not supported`)
  }
  const destination = hubRegionId(
    transition.destination,
    `${field}.transition.destination`,
  )
  const sourceRegion = hubRegionId(
    transition.sourceRegion,
    `${field}.transition.sourceRegion`,
  )
  if (
    ((transition.phase === 'college-intro' || transition.phase === 'outgoing')
      && region !== sourceRegion)
    || ((transition.phase === 'college-loadout' || transition.phase === 'incoming')
      && region !== destination)
    || !isHubTransitionEdge(sourceRegion, destination)
  ) {
    throw new GameProtocolError(`${field}.transition is inconsistent with its region`)
  }
  return {
    activity,
    collegeIntro,
    region,
    transition: {
      alpha,
      destination,
      phase: transition.phase,
      scriptedSpeed: positiveFinite(
        transition.scriptedSpeed,
        `${field}.transition.scriptedSpeed`,
      ),
      scriptedTarget: vector(
        transition.scriptedTarget,
        `${field}.transition.scriptedTarget`,
      ),
      sourceRegion,
    },
  }
}

function hubCollegeIntroState(
  value: unknown,
  field: string,
  region: HubRegionId,
): NativeCollegeIntroState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'contactCounter',
    'coverAlpha',
    'dialogueSequence',
    'officeSpeed',
    'pathCursor',
    'phase',
    'titleCursor',
  ])
  if (
    source.phase !== 'courtyard-walk'
    && source.phase !== 'office-walk'
    && source.phase !== 'arch-dialogue'
  ) throw new GameProtocolError(`${field}.phase is not supported`)
  if (
    (source.phase === 'courtyard-walk' && region !== 'courtyard')
    || (source.phase !== 'courtyard-walk' && region !== 'office')
  ) throw new GameProtocolError(`${field}.phase is inconsistent with its region`)
  const pathCursor = nonnegativeFinite(source.pathCursor, `${field}.pathCursor`)
  const maximumPathCursor = source.phase === 'courtyard-walk' ? 9 : 6
  if (pathCursor > maximumPathCursor) {
    throw new GameProtocolError(`${field}.pathCursor exceeds its authored spline`)
  }
  const titleCursor = nonnegativeFinite(source.titleCursor, `${field}.titleCursor`)
  if (titleCursor > 5) throw new GameProtocolError(`${field}.titleCursor exceeds its spline`)
  const coverAlpha = nonnegativeFinite(source.coverAlpha, `${field}.coverAlpha`)
  if (coverAlpha > 1) throw new GameProtocolError(`${field}.coverAlpha exceeds one`)
  const officeSpeed = positiveFinite(source.officeSpeed, `${field}.officeSpeed`)
  if (officeSpeed < 0.5 || officeSpeed > 1) {
    throw new GameProtocolError(`${field}.officeSpeed is outside the native lane`)
  }
  const contactCounter = nonnegativeInteger(source.contactCounter, `${field}.contactCounter`)
  if (contactCounter > 10 || contactCounter % 2 !== 0) {
    throw new GameProtocolError(`${field}.contactCounter is outside the native lane`)
  }
  return {
    contactCounter,
    coverAlpha,
    dialogueSequence: nonnegativeInteger(
      source.dialogueSequence,
      `${field}.dialogueSequence`,
    ),
    officeSpeed,
    pathCursor,
    phase: source.phase as NativeCollegeIntroPhase,
    titleCursor,
  }
}

export function hubPlayerActivity(value: unknown, field: string): HubPlayerActivity {
  return memberString(value, field, HUB_PLAYER_ACTIVITIES) as HubPlayerActivity
}

function hubRegionId(value: unknown, field: string): HubRegionId {
  const result = limitedString(value, field, 32)
  if (!isHubRegionId(result)) {
    throw new GameProtocolError(`${field} is not supported`)
  }
  return result
}

export function hubSkorchaState(value: unknown, field: string): ProtocolHubSkorchaState | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'dismissalIndex',
    'gesture',
    'gestureTicksRemaining',
    'hatFrame',
    'position',
    'variant',
  ])
  return {
    dismissalIndex: integerWithin(source.dismissalIndex, `${field}.dismissalIndex`, 0, 2) as 0 | 1 | 2,
    gesture: integerWithin(source.gesture, `${field}.gesture`, 0, 2) as 0 | 1 | 2,
    gestureTicksRemaining: integerWithin(
      source.gestureTicksRemaining,
      `${field}.gestureTicksRemaining`,
      1,
      29,
    ),
    hatFrame: integerWithin(source.hatFrame, `${field}.hatFrame`, 0, 4) as 0 | 1 | 2 | 3 | 4,
    position: vector(source.position, `${field}.position`),
    variant: integerWithin(source.variant, `${field}.variant`, 0, 2) as 0 | 1 | 2,
  }
}
