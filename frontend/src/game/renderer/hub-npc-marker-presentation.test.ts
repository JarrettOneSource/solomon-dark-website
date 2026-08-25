import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_HUB_NPC_CATALOG,
  createNativeHubNpcState,
} from '../core-kernels/native-hub-npc.ts'
import {
  captureHubNpcMarkerSuppression,
  hubNpcDirectionalHintFrame,
  hubNpcMarkerFrame,
  hubNpcOnboardingPlan,
} from './hub-npc-marker-presentation.ts'

const ACTORS = [
  ['hagatha', 'courtyard', 'help', 'right', 61, false],
  ['annalist', 'courtyard', 'talk', 'right', 59, true],
  ['fomentius', 'courtyard', 'help', 'right', 61, true],
  ['luthacus', 'courtyard', 'talk', 'left', 60, true],
  ['skorcha', 'courtyard', 'talk', 'right', 59, true],
  ['teacher', 'courtyard', 'help', 'left', 62, false],
  ['memorator', 'mortuary', 'help', 'left', 27, true],
  ['librarian', 'library', 'help', 'right', 19, true],
  ['shlorio', 'library', 'help', 'left', 20, true],
  ['arch-chancellor', 'office', 'help', 'right', 15, true],
] as const

test('the generated marker catalog drains every Region bank and named survival actor', () => {
  assert.deepEqual(NATIVE_HUB_NPC_CATALOG.markers.regionBanks, [
    { atlas: 'College', records: [59, 60, 61, 62], region: 'courtyard' },
    { atlas: 'Memoratorium', records: [24, 25, 26, 27], region: 'mortuary' },
    { atlas: 'Library', records: [17, 18, 19, 20], region: 'library' },
    { atlas: 'Storage', records: [7, 8, 9, 10], region: 'storeroom' },
    { atlas: 'Office', records: [13, 14, 15, 16], region: 'office' },
  ])
  assert.deepEqual(
    NATIVE_HUB_NPC_CATALOG.markers.actors.map((actor) => [
      actor.interactionId,
      actor.region,
      actor.style,
      actor.side,
      actor.record,
      actor.phaseAdvances,
    ]),
    ACTORS,
  )
})

test('ordinary marker plans use exact roots, styles, independent phases, and modal ordering', () => {
  const acknowledged = Array<boolean>(10).fill(false)
  const suppression = captureHubNpcMarkerSuppression(acknowledged)
  for (const [interactionId, region, style, side, record, phaseAdvances] of ACTORS) {
    const frame = hubNpcMarkerFrame(interactionId, 125, 91, suppression, {
      skorchaPosition: { x: 669, y: 705.5 },
      skorchaVariant: 2,
      surface: null,
    })
    assert.equal(frame.visible, true, interactionId)
    assert.equal(frame.region, region)
    assert.equal(frame.style, style)
    assert.equal(frame.side, side)
    assert.equal(frame.record, record)
    assert.ok(frame.alpha >= 0.5 && frame.alpha <= 1)
    const geometry = NATIVE_HUB_NPC_CATALOG.interactions[interactionId].geometry
    const position = interactionId === 'skorcha' ? { x: 669, y: 705.5 } : geometry.position
    assert.deepEqual(frame.position, {
      x: position.x + (side === 'right' ? 30 : -30),
      y: position.y - 60,
    })

    const next = hubNpcMarkerFrame(interactionId, 126, 91, suppression, {
      skorchaPosition: { x: 669, y: 705.5 },
      skorchaVariant: 2,
      surface: null,
    })
    assert.equal(next.phaseDegrees - frame.phaseDegrees, phaseAdvances ? 1 : 0)
    assert.equal(hubNpcMarkerFrame(interactionId, 125, 91, suppression, {
      skorchaPosition: { x: 669, y: 705.5 },
      skorchaVariant: 2,
      surface: 'dialogue',
    }).visible, true)
    assert.equal(hubNpcMarkerFrame(interactionId, 125, 91, suppression, {
      skorchaPosition: { x: 669, y: 705.5 },
      skorchaVariant: 2,
      surface: 'service',
    }).visible, false)
  }
})

test('fresh-profile suppression remains actor-local until Courtyard reconstruction', () => {
  const fresh = createNativeHubNpcState().helpFlags
  const constructed = captureHubNpcMarkerSuppression(fresh)
  assert.equal(hubNpcMarkerFrame('annalist', 0, 1, constructed).visible, false)
  assert.equal(hubNpcMarkerFrame('fomentius', 0, 1, constructed).visible, false)
  assert.equal(hubNpcMarkerFrame('luthacus', 0, 1, constructed).visible, false)
  assert.equal(hubNpcMarkerFrame('hagatha', 0, 1, constructed).visible, true)

  const liveCleared = [...fresh]
  liveCleared[0] = false
  assert.equal(
    hubNpcMarkerFrame('annalist', 0, 1, constructed).visible,
    false,
    'clearing the durable row must not mutate this constructed actor',
  )
  assert.equal(
    hubNpcMarkerFrame(
      'annalist',
      0,
      1,
      captureHubNpcMarkerSuppression(liveCleared),
    ).visible,
    true,
  )
})

test('Skorcha marker follows presence and the mirrored variant side', () => {
  const suppression = captureHubNpcMarkerSuppression(Array<boolean>(10).fill(false))
  assert.equal(hubNpcMarkerFrame('skorcha', 0, 1, suppression, {
    skorchaPosition: null,
    skorchaVariant: null,
    surface: null,
  }).visible, false)
  const mirrored = hubNpcMarkerFrame('skorcha', 0, 1, suppression, {
    skorchaPosition: { x: 1637, y: 403.5 },
    skorchaVariant: 1,
    surface: null,
  })
  assert.equal(mirrored.visible, true)
  assert.equal(mirrored.side, 'left')
  assert.equal(mirrored.record, 60)
  assert.deepEqual(mirrored.position, { x: 1607, y: 343.5 })
})

test('pristine and follow-up onboarding plans use exact content, cadence, and modal gates', () => {
  const fresh = Array<boolean>(10).fill(true)
  assert.deepEqual(hubNpcOnboardingPlan(fresh, 0, null), [{
    arrowOffset: { x: 15, y: -65 },
    arrowRecord: 28,
    arrowRotationDegrees: 200,
    kind: 'walk-to-talk',
    target: 'annalist',
    text: 'WALK INTO WIZARDS\nTO TALK TO THEM',
    textOffset: { x: 15, y: -115 },
  }])
  assert.deepEqual(hubNpcOnboardingPlan(fresh, 0, 'dialogue'), [])

  const followup = [...fresh]
  followup[0] = false
  assert.deepEqual(hubNpcOnboardingPlan(followup, 40, null), [])
  assert.deepEqual(hubNpcOnboardingPlan(followup, 41, null).map(({ kind, target }) => (
    [kind, target]
  )), [
    ['directional', 'fomentius'],
    ['directional', 'luthacus'],
  ])
  assert.deepEqual(hubNpcOnboardingPlan(followup, 79, 'inventory'), [])
  assert.deepEqual(hubNpcOnboardingPlan(followup, 80, null), [])
})

test('directional hints clamp to the viewport and rotate back toward the actor root', () => {
  assert.deepEqual(hubNpcDirectionalHintFrame(
    { x: 1_900, y: 450 },
    { height: 900, width: 1_600 },
  ), {
    position: { x: 1_542, y: 450 },
    rotationRadians: 0,
  })
  assert.deepEqual(hubNpcDirectionalHintFrame(
    { x: 800, y: -200 },
    { height: 900, width: 1_600 },
  ), {
    position: { x: 800, y: 64 },
    rotationRadians: -Math.PI / 2,
  })
})
