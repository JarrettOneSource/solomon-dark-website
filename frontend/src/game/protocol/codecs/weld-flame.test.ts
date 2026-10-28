import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeFlameLashFactory } from '../../core-kernels/native-weld-flame-birth.ts'
import { createNativeWorldManagerOrder } from '../../core-kernels/native-world-manager-order.ts'
import { createNativeRng } from '../../core-kernels/native-rng.ts'
import { createNativeWeldFlameLashFade } from '../../core-kernels/native-weld-flame-lash.ts'
import { nativeFlameLashBirthPhase, nativeFlameLashFactoryGeometry, nativeFlameLashPathPoints } from '../../core-kernels/native-weld-flame-ribbon.ts'
import { createNativeWeldChannelActor } from '../../core-kernels/native-weld-primary-runtime.ts'
import type { NativeFlameChannelBirth } from '../../core-kernels/native-weld-flame-state.ts'
import { createGameSimulation } from '../../core-server/game-simulation.ts'
import { createGameSnapshot } from '../../host/game-snapshot.ts'
import { createGameSnapshotFrame, createReplicatedEntityBaseline, EntityReplicationReconstructor } from '../entity-replication.ts'
import { decodeServerGameMessage, encodeGameMessage } from '../game-protocol.ts'
import { gameSnapshot } from './snapshot.ts'
import { primarySpellTransient } from './primary-transients.ts'
import { GameProtocolError } from './values.ts'

const flameVector = [8, 2, 1, .8, 0, 0, 0, 0]
const suppressed = { kind: 'legacy-suppressed' } as const
function channel(role: 'main' | 'chain' = 'main', weak = false, enhancedEffects = true, long = true) {
  const start = { x: 0, y: 0 }
  const control = { x: long ? 400 : 10, y: 0 }
  const end = { x: long ? 800 : 20, y: 0 }
  const offset = { x: 0, y: role === 'chain' ? -20 : 0 }
  const birthTick = 123
  const geometry = nativeFlameLashFactoryGeometry({ start, control, end, offset })
  const flameVisual: NativeFlameChannelBirth = { kind: 'native-birth-v1', role, start, control, end, offset,
    cameraDisplacement: role === 'main' && !weak ? { x: 4, y: 0 } : null,
    width: role === 'chain' ? Math.fround(.8) : weak ? .75 : 1,
    ribbon: long ? { kind: 'long', phaseDegrees: nativeFlameLashBirthPhase(birthTick) }
      : { kind: 'short', widthFactor: 1 },
    path: { intensity: weak ? .25 : 1, radiusFactors: nativeFlameLashPathPoints(geometry).map(() => 1),
      creatorRegistration: { managerLane: 'actor', registrationOrdinal: 2 }, miscAppendOrdinal: role === 'main' ? 0 : 1 } }
  return { ...createNativeWeldChannelActor({ buildId: 1003, direction: { x: 1, y: 0 },
    endpoint: end, midpoint: control, origin: start, ownerId: 'owner', id: 4, tick: birthTick,
    targetId: null, underpowered: weak, enhancedEffects, vector: flameVector, worldKey: 'hub:courtyard', flameVisual }),
  flameVisual, painterRegistrations: [{ managerLane: 'actor' as const, registrationOrdinal: 4 }] }
}
function fade(variant: 'source' | 'endpoint' | 'chain' = 'endpoint', weak = false, enhancedEffects = true) {
  return createNativeWeldFlameLashFade({ id: 5, tick: 123, ownerId: 'owner', worldKey: 'hub:courtyard',
    direction: { x: 1, y: 0 }, origin: { x: 0, y: 0 }, variant, vector: flameVector,
    enhancedEffects, alpha: weak ? .5 : 1, rng: createNativeRng(42) }).actor
}
function decode(value: unknown) { return primarySpellTransient(value, 'flame') }
function rejects(value: unknown, pattern?: RegExp) {
  assert.throws(() => decode(value), pattern ?? GameProtocolError)
}

test('all Flame role, quality and geometry branches roundtrip exact retained samples', () => {
  for (const role of ['main', 'chain'] as const) for (const weak of [false, true]) {
    if (role === 'chain' && weak) continue
    for (const enhanced of [false, true]) for (const long of [false, true]) {
      const actor = channel(role, weak, enhanced, long)
      assert.deepEqual(decode(JSON.parse(JSON.stringify(actor))), actor)
      const visual = actor.flameVisual
      const lower = { ...actor, flameVisual: { ...visual,
        width: role === 'chain' ? .5 : visual.width,
        ribbon: visual.ribbon.kind === 'short' ? { kind: 'short', widthFactor: .75 } : visual.ribbon,
        path: { ...visual.path, intensity: weak ? .0625 : .25, radiusFactors: visual.path.radiusFactors.map(() => .75) } } }
      assert.deepEqual(decode(lower), lower)
    }
  }
})

test('authoritative factory samples pass the same wire contract without rewriting values', () => {
  for (const role of ['main', 'chain'] as const) for (const enhancedEffects of [true, false]) {
    const actor = channel(role, false, enhancedEffects)
    const visual = actor.flameVisual
    const order = createNativeWorldManagerOrder()
    const born = createNativeFlameLashFactory({
      channel: { ...actor, tick: actor.birthTick }, sourceFadeId: 5, geometry: visual, role,
      width: visual.width, cameraDisplacement: visual.cameraDisplacement, creatorRegistration: visual.path.creatorRegistration,
      miscAppendOrdinal: visual.path.miscAppendOrdinal, registerWorldPainter: order.register, rng: createNativeRng(42),
    })
    assert.deepEqual(decode(JSON.parse(JSON.stringify(born.channel))), born.channel)
    assert.deepEqual(decode(JSON.parse(JSON.stringify(born.source))), born.source)
  }
})

test('long Flame phases retain signed32 birth overflow and reject a snapshot-clock substitution', () => {
  const actor = channel()
  for (const birthTick of [0, 0x2aaa_aaaa, 0x7fff_ffff, 0x8000_0000, 0xffff_ffff]) {
    const phaseDegrees = Math.fround(Math.imul(birthTick, -3))
    const current = { ...actor, birthTick, flameVisual: { ...actor.flameVisual, ribbon: { kind: 'long', phaseDegrees } } }
    assert.deepEqual(decode(current), current)
    rejects({ ...current, flameVisual: { ...current.flameVisual, ribbon: { kind: 'long', phaseDegrees: phaseDegrees + 1 } } }, /birth clock/)
  }
  rejects({ ...actor, flameVisual: { ...actor.flameVisual, offset: { x: 1e300, y: 0 } } }, /offset/)
})

test('native fade clocks include birth update, every quality lifetime and packed-zero survivors', () => {
  for (const variant of ['source', 'endpoint', 'chain'] as const) for (const weak of [false, true]) {
    if (weak && variant !== 'endpoint') continue
    for (const enhanced of [false, true]) {
      const actor = fade(variant, weak, enhanced)
      const birthAlpha = variant === 'source' || weak ? .5 : 1
      let alpha = birthAlpha
      let survivorCount = 0
      for (let ageTicks = 0; ageTicks <= 6; ageTicks += 1) {
        alpha = Math.fround(alpha - actor.alphaStep)
        const aged = { ...actor, ageTicks, alpha }
        if (alpha > 0) { survivorCount += 1; assert.deepEqual(decode(aged), aged) }
        else rejects(aged)
      }
      assert.equal(survivorCount, enhanced ? weak ? 2 : 5 : variant === 'source' || weak ? 1 : 2)
      rejects({ ...actor, alpha: birthAlpha }, /birth-update clock/)
      rejects({ ...actor, ageTicks: Number.MAX_SAFE_INTEGER }, /birth-update clock/)
      rejects({ ...actor, alphaStep: Math.fround(.3) }, /alphaStep/)
      if (enhanced && !weak) {
        let lastAlpha = birthAlpha
        for (let step = 0; step < 5; step += 1) lastAlpha = Math.fround(lastAlpha - actor.alphaStep)
        assert.ok(lastAlpha > 0 && lastAlpha * 255 < 1)
      }
    }
  }
})

test('new and legacy chain scale and painter domains stay disjoint', () => {
  const actor = fade('chain')
  for (const baseScale of [.5, 1]) assert.equal((decode({ ...actor, baseScale }) as typeof actor).baseScale, baseScale)
  for (const baseScale of [Math.fround(.05), Math.fround(.1), .49, 1.01]) rejects({ ...actor, baseScale }, /baseScale/)
  const legacy = { ...actor, alpha: 1, ageTicks: 0, flameVisual: suppressed,
    baseScale: Math.fround(.1), lightRegistration: null,
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 5 }] }
  assert.deepEqual(decode(legacy), legacy)
  assert.deepEqual(decode({ ...legacy, baseScale: Math.fround(.05) }), { ...legacy, baseScale: Math.fround(.05) })
  rejects({ ...legacy, baseScale: .5 }, /baseScale/)
  rejects({ ...legacy, lightRegistration: actor.lightRegistration }, /must be null/)
  rejects({ ...actor, painterRegistrations: legacy.painterRegistrations }, /managerLane/)
  rejects({ ...legacy, painterRegistrations: actor.painterRegistrations }, /managerLane/)
  rejects({ ...actor, lightRegistration: { managerLane: 'transient', registrationOrdinal: 6 } }, /painter root/)
  rejects({ ...fade('source'), lightRegistration: actor.lightRegistration }, /must be null/)
  rejects({ ...actor, flameVisual: { kind: 'native-birth-v1', birthAlpha: .5 } }, /birth-update clock/)
})

test('Flame retained schema rejects missing, unknown, mixed and cross-build fields', () => {
  const actor = channel()
  const { flameVisual, ...missing } = actor
  rejects(missing, /flameVisual/)
  for (const bad of [null, {}, { kind: 'future' }, { kind: 'legacy-suppressed', width: 1 }]) rejects({ ...actor, flameVisual: bad })
  for (const key of ['role', 'start', 'control', 'end', 'offset', 'width', 'ribbon', 'path', 'cameraDisplacement']) {
    const missingField = { ...flameVisual } as Record<string, unknown>
    delete missingField[key]
    rejects({ ...actor, flameVisual: missingField })
  }
  rejects({ ...actor, flameVisual: { ...flameVisual, surprise: 1 } }, /not allowed/)
  rejects({ ...actor, buildId: 1004, vector: flameVector.slice(0, 7) }, /flameVisual/)
  rejects({ ...fade(), buildId: 1004, vector: flameVector.slice(0, 7) }, /not Flame Lash/)
  rejects({ ...actor, flameVisual: { ...flameVisual, ribbon: { kind: 'short', widthFactor: 1 } } }, /native span/)
  rejects({ ...actor, flameVisual: { ...flameVisual, ribbon: { kind: 'long', phaseDegrees: -1 } } }, /birth clock/)
  rejects({ ...actor, flameVisual: { ...flameVisual, ribbon: { ...flameVisual.ribbon, widthFactor: 1 } } }, /not allowed/)
  rejects({ ...actor, flameVisual: { ...flameVisual, start: { x: 0, y: 0, z: 1 } } }, /not allowed/)
  rejects({ ...actor, underpowered: true }, /cameraDisplacement/)
  for (const cameraDisplacement of [null, { x: .1, y: 0 }, { x: 4, y: 4 }, { x: 4, y: 0, z: 0 }]) {
    rejects({ ...actor, flameVisual: { ...flameVisual, cameraDisplacement } })
  }
  for (const other of [channel('chain'), channel('main', true)]) {
    rejects({ ...other, flameVisual: { ...other.flameVisual, cameraDisplacement: { x: 0, y: 0 } } }, /cameraDisplacement/)
  }
  rejects({ ...channel('chain'), underpowered: true }, /width/)
  const old = { ...actor, flameVisual: suppressed }
  assert.deepEqual(decode(old), old)
  for (const malformed of [undefined, { kind: 'native-birth-v1' }, { kind: 'native-birth-v1', birthAlpha: .75 },
    { kind: 'native-birth-v1', birthAlpha: 1, extra: 1 }]) rejects({ ...fade(), flameVisual: malformed })
})

test('Flame path cardinality, inclusive samples, registration and work budgets are strict', () => {
  const actor = channel()
  const visual = actor.flameVisual
  const path = visual.path
  for (const replacement of [
    { ...path, intensity: 1.001 }, { ...path, intensity: .24 },
    { ...path, radiusFactors: [.74, ...path.radiusFactors.slice(1)] },
    { ...path, radiusFactors: [1.01, ...path.radiusFactors.slice(1)] },
    { ...path, radiusFactors: path.radiusFactors.slice(1) },
    { ...path, radiusFactors: [...path.radiusFactors, 1] },
    { ...path, radiusFactors: Array(1_025).fill(1) },
    { ...path, creatorRegistration: { managerLane: 'transient', registrationOrdinal: 2 } },
    { ...path, creatorRegistration: { managerLane: 'actor', registrationOrdinal: Number.MAX_SAFE_INTEGER + 1 } },
    { ...path, creatorRegistration: { managerLane: 'actor', registrationOrdinal: 2, extra: 0 } },
    { ...path, miscAppendOrdinal: 1 }, { ...path, miscAppendOrdinal: -1 }, { ...path, extra: 0 },
  ]) rejects({ ...actor, flameVisual: { ...visual, path: replacement } })
  rejects({ ...actor, flameVisual: { ...visual, control: { x: 1e300, y: 0 } } }, /stored native Flame coordinates/)
  rejects({ ...actor, flameVisual: { ...visual, end: { x: 1e300, y: 0 } } }, /stored native Flame coordinates/)
  rejects({ ...actor, flameVisual: { ...visual, control: { x: 40_000, y: 0 } } }, /budget/)
  const short = channel('main', false, true, false)
  rejects({ ...short, flameVisual: { ...short.flameVisual, ribbon: { kind: 'short', widthFactor: 1.001 } } })
})

test('complete Flame state survives object, compact keyframe and delta transport without resampling', () => {
  const base = createGameSnapshot(createGameSimulation({ owner: { discipline: 'arcane', displayName: 'Flame', element: 'fire' } }), 'owner')
  const actors = [channel(), fade()]
  const snapshot = { ...base, tick: 123, flamePresentation: { kind: 'reset' as const, epoch: 1, worldKey: 'hub', throughTick: 123, births: [] as const }, primarySpells: { nextId: 6, projectiles: [], transients: actors } }
  assert.deepEqual(gameSnapshot(JSON.parse(JSON.stringify(snapshot))).primarySpells, snapshot.primarySpells)
  for (const keyframe of [true, false]) {
    const reconstructor = new EntityReplicationReconstructor()
    reconstructor.reset(base, 1)
    const frame = createGameSnapshotFrame(snapshot, 1, createReplicatedEntityBaseline(base), keyframe)
    const message = decodeServerGameMessage(encodeGameMessage({ type: 'server-snapshot', acknowledgedInputSequence: 0, frame, sequence: 2 }))
    assert.equal(message.type, 'server-snapshot')
    if (message.type !== 'server-snapshot') throw new Error('Expected snapshot')
    const restored = reconstructor.apply(message.frame, 2).primarySpells
    assert.equal(restored.nextId, snapshot.primarySpells.nextId)
    assert.deepEqual(restored.projectiles, snapshot.primarySpells.projectiles)
    assert.deepEqual(restored.transients, snapshot.primarySpells.transients)
  }
})
