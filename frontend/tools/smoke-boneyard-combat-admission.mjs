import assert from 'node:assert/strict'

// Boneyard combat is sealed until Solomon's encounter has run: the simulation
// admits combat input only while isBoneyardPlayerCombatEnabled(encounter)
// holds (runEventId > 0), and BoneyardScene publishes that gate as
// data-combat-enabled. A touch smoke that expects a cast therefore proves the
// seal first, enters the arena the way a player does (the runtime smoke's
// crossEntryGate and walkToSolomon, driven by the movement joystick instead of
// WASD) and waits for Solomon's run event before it holds the primary joystick.

const SEALED_HOLD_SAMPLES = 20
const SEALED_HOLD_SAMPLE_MS = 50
// PLAYER_CHARACTER_STEADY_SPEED: one pixel per 10ms movement tick
const PLAYER_STEADY_SPEED_PX_PER_SECOND = 100
// joystickVector clamps past the base's 0.34 input radius, so this deflection
// is full speed while the touch stays inside the base
const MOVEMENT_FULL_DEFLECTION = 0.4
const GATE_ALIGN_TOLERANCE_PX = 3
const GATE_CROSSING_MARGIN_PX = 35
const GATE_CROSSING_DEADLINE_MS = 8_000
const GATE_SWING_DEADLINE_MS = 5_000
const SOLOMON_APPROACH_DEADLINE_MS = 120_000
const SOLOMON_APPROACH_PULSE_MS = 150
const SOLOMON_RUN_DEADLINE_MS = 30_000

export async function solomonApproachReceipt(scene) {
  return scene.evaluate((node) => {
    const playerX = Number(node.getAttribute('data-local-player-x'))
    const playerY = Number(node.getAttribute('data-local-player-y'))
    const solomonX = Number(node.getAttribute('data-solomon-x'))
    const solomonY = Number(node.getAttribute('data-solomon-y'))
    return {
      combatEnabled: node.getAttribute('data-combat-enabled'),
      distance: Math.hypot(solomonX - playerX, solomonY - playerY),
      phase: node.getAttribute('data-solomon-phase'),
      playerX,
      playerY,
      runEventId: Number(node.getAttribute('data-solomon-run-event-id')),
      solomonX,
      solomonY,
      voiceEventId: Number(node.getAttribute('data-solomon-voice-event-id')),
    }
  })
}

// The movement joystick as a stick: its centre and the full-speed deflection.
function joystickStick(base) {
  return {
    center: { x: base.x + base.width / 2, y: base.y + base.height / 2 },
    offset: Math.min(base.width, base.height) * MOVEMENT_FULL_DEFLECTION,
  }
}

// Twice the steady-speed travel time plus the runtime smoke's three seconds.
function travelDeadlineMs(distancePx) {
  return Math.ceil((distancePx / PLAYER_STEADY_SPEED_PX_PER_SECOND) * 1000) * 2 + 3_000
}

async function touchStart(cdp, touchId, point) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: touchId, x: point.x, y: point.y }],
  })
}

async function touchMove(cdp, touchId, point) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: touchId, x: point.x, y: point.y }],
  })
}

async function touchEnd(cdp) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

// A primary joystick held before Solomon runs must arm nothing: the scene stays
// sealed and the frame never lists a primary spell for a settled run of samples.
export async function assertBoneyardCombatSealed(page, cdp, scene, primary) {
  const initial = await solomonApproachReceipt(scene)
  assert.equal(initial.phase, 'digging', `Solomon must still be digging: ${JSON.stringify(initial)}`)
  assert.equal(initial.combatEnabled, 'false', `combat must be sealed: ${JSON.stringify(initial)}`)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: primary.center.x, y: primary.center.y }],
  })
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: primary.center.x + primary.offset, y: primary.center.y }],
    })
    const samples = []
    for (let sample = 0; sample < SEALED_HOLD_SAMPLES; sample += 1) {
      samples.push(await page.evaluate(() => {
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        const joystick = document.querySelector('[data-joystick="primary"]')
        return {
          active: joystick?.dataset.active ?? null,
          combatEnabled: document.querySelector('.boneyard-scene')?.getAttribute('data-combat-enabled') ?? null,
          primarySpellKinds: [...(frame?.primarySpellKinds ?? [])],
        }
      }))
      await page.waitForTimeout(SEALED_HOLD_SAMPLE_MS)
    }
    assert.deepEqual(
      samples,
      samples.map(() => ({ active: 'true', combatEnabled: 'false', primarySpellKinds: [] })),
      `a held primary joystick must stay sealed before Solomon runs: ${JSON.stringify(samples)}`,
    )
    return samples.length
  } finally {
    await touchEnd(cdp)
  }
}

// data-gate-state lists every gate leaf as `<gate>:<side>:<tipX>,<tipY>`; a
// gate with both leaves published has a centre between their tips.
export function entryGateCenters(gateState) {
  const gates = new Map()
  for (const serialized of gateState?.split('|') || []) {
    const separator = serialized.lastIndexOf(':')
    if (separator < 0) continue
    const id = serialized.slice(0, separator)
    const [x, y] = serialized.slice(separator + 1).split(',').map(Number)
    const gateId = id.slice(0, id.lastIndexOf(':'))
    if (!Number.isFinite(x) || !Number.isFinite(y) || !gateId) continue
    const tips = gates.get(gateId) || []
    tips.push({ x, y })
    gates.set(gateId, tips)
  }
  return [...gates.values()]
    .filter((tips) => tips.length === 2)
    .map((tips) => ({
      x: (tips[0].x + tips[1].x) / 2,
      y: (tips[0].y + tips[1].y) / 2,
    }))
}

// Hold the movement joystick one way until the player has travelled `distance`
// along one axis from `initial` toward `direction`, or the deadline passes with
// the last receipt in the error.
async function holdJoystickUntilTravelled(page, cdp, scene, stick, heading, travel, touchId) {
  const attribute = travel.axis === 'x' ? 'data-local-player-x' : 'data-local-player-y'
  await touchStart(cdp, touchId, stick.center)
  try {
    await touchMove(cdp, touchId, {
      x: stick.center.x + heading.x * stick.offset,
      y: stick.center.y + heading.y * stick.offset,
    })
    try {
      await page.waitForFunction(
        ({ attribute, direction, distance, initial }) => {
          const value = Number(document.querySelector('.boneyard-scene')?.getAttribute(attribute))
          return Number.isFinite(value) && (value - initial) * direction >= distance
        },
        { attribute, direction: travel.direction, distance: travel.distance, initial: travel.initial },
        { timeout: travel.deadlineMs },
      )
    } catch (error) {
      throw new Error(
        `${travel.purpose} did not travel ${travel.distance.toFixed(1)}px within ${travel.deadlineMs}ms: `
        + JSON.stringify(await solomonApproachReceipt(scene)),
        { cause: error },
      )
    }
  } finally {
    await touchEnd(cdp)
  }
}

// The spawn stands outside the arena fence, and the entry gate is a pair of
// physical leaves (boneyard-gate.ts) that the player's body pushes open on
// contact, so the approach begins the way the runtime smoke's crossEntryGate
// does: align with the nearest gate's centre, then push straight through it
// until the player stands past the leaves and the gate has swung.
export async function crossEntryGateWithJoystick(page, cdp, scene, movementBase, touchId = 11) {
  const stick = joystickStick(movementBase)
  const start = await solomonApproachReceipt(scene)
  const initialGateState = await scene.getAttribute('data-gate-state')
  const centers = entryGateCenters(initialGateState)
  assert.ok(centers.length > 0, `expected an entry gate in ${initialGateState}`)
  const gate = centers.reduce((nearest, center) => (
    Math.hypot(center.x - start.playerX, center.y - start.playerY)
      < Math.hypot(nearest.x - start.playerX, nearest.y - start.playerY)
      ? center
      : nearest
  ))
  const alignDelta = gate.x - start.playerX
  if (Math.abs(alignDelta) > GATE_ALIGN_TOLERANCE_PX) {
    await holdJoystickUntilTravelled(page, cdp, scene, stick, { x: Math.sign(alignDelta), y: 0 }, {
      axis: 'x',
      deadlineMs: travelDeadlineMs(Math.abs(alignDelta)),
      direction: Math.sign(alignDelta),
      distance: Math.abs(alignDelta) - GATE_ALIGN_TOLERANCE_PX,
      initial: start.playerX,
      purpose: 'aligning with the entry gate',
    }, touchId)
  }
  const aligned = await solomonApproachReceipt(scene)
  const direction = Math.sign(gate.y - aligned.playerY)
  assert.notEqual(direction, 0, `the entry gate must lie beyond the player: ${JSON.stringify({ aligned, gate })}`)
  const crossingDistance = Math.abs(gate.y - aligned.playerY) + GATE_CROSSING_MARGIN_PX
  await holdJoystickUntilTravelled(page, cdp, scene, stick, { x: 0, y: direction }, {
    axis: 'y',
    deadlineMs: Math.max(GATE_CROSSING_DEADLINE_MS, travelDeadlineMs(crossingDistance)),
    direction,
    distance: crossingDistance,
    initial: aligned.playerY,
    purpose: 'pushing through the entry gate',
  }, touchId)
  const crossed = await solomonApproachReceipt(scene)
  try {
    await page.waitForFunction(
      (initial) => document.querySelector('.boneyard-scene')?.getAttribute('data-gate-state') !== initial,
      initialGateState,
      { timeout: GATE_SWING_DEADLINE_MS },
    )
  } catch (error) {
    throw new Error(
      `the entry gate never swung after the crossing: ${JSON.stringify({ crossed, gate })}`,
      { cause: error },
    )
  }
  return {
    alignedX: aligned.playerX,
    crossedY: crossed.playerY,
    direction,
    gate,
    startPosition: { x: start.playerX, y: start.playerY },
  }
}

// Hold the movement joystick toward Solomon, re-aiming every pulse, until the
// encounter leaves its digging phase. Mirrors the runtime smoke's keyboard
// walker: a stalled approach follows the blocking wall, flipping sides when a
// side runs dry. Two exits: contact, or the deadline with the last receipt.
export async function walkToSolomonWithJoystick(page, cdp, scene, movementBase, touchId = 11) {
  const stick = joystickStick(movementBase)
  const startedAt = Date.now()
  const samples = []
  let stalledSteps = 0
  let wallFollow = null
  const aim = async (direction) => {
    const scale = Math.hypot(direction.x, direction.y) || 1
    await touchMove(cdp, touchId, {
      x: stick.center.x + (direction.x / scale) * stick.offset,
      y: stick.center.y + (direction.y / scale) * stick.offset,
    })
  }
  await touchStart(cdp, touchId, stick.center)
  try {
    while (Date.now() - startedAt < SOLOMON_APPROACH_DEADLINE_MS) {
      const before = await solomonApproachReceipt(scene)
      samples.push(before)
      if (before.phase !== 'digging') {
        return {
          contactPosition: { x: before.playerX, y: before.playerY },
          elapsedMs: Date.now() - startedAt,
          phase: before.phase,
          samples: samples.length,
          startPosition: { x: samples[0].playerX, y: samples[0].playerY },
        }
      }
      const dx = before.solomonX - before.playerX
      const dy = before.solomonY - before.playerY
      let direction = { x: dx, y: dy }
      if (wallFollow) {
        direction = {
          x: dx * 0.25 - dy * wallFollow.sign,
          y: dy * 0.25 + dx * wallFollow.sign,
        }
        wallFollow.steps += 1
      }
      await aim(direction)
      await page.waitForTimeout(SOLOMON_APPROACH_PULSE_MS)
      const after = await solomonApproachReceipt(scene)
      if (after.phase !== 'digging') continue
      if (wallFollow && after.distance < wallFollow.blockedDistance - 30) {
        wallFollow = null
        stalledSteps = 0
      } else if (wallFollow?.steps >= 50) {
        wallFollow = { blockedDistance: after.distance, sign: -wallFollow.sign, steps: 0 }
      } else if (!wallFollow && after.distance < before.distance - 1) {
        stalledSteps = 0
      } else if (!wallFollow) {
        stalledSteps += 1
        if (stalledSteps >= 4) {
          wallFollow = { blockedDistance: after.distance, sign: 1, steps: 0 }
          stalledSteps = 0
        }
      }
    }
  } finally {
    await touchEnd(cdp)
  }
  throw new Error(
    `the movement joystick could not reach Solomon within ${SOLOMON_APPROACH_DEADLINE_MS / 1000}s: `
    + JSON.stringify({ last: samples.at(-1), samples: samples.length, start: samples[0] }),
  )
}

// After contact Solomon speaks, then runs; his run event is what admits combat.
export async function waitForBoneyardCombatAdmission(page, scene) {
  try {
    await page.waitForFunction(
      () => document.querySelector('.boneyard-scene')?.getAttribute('data-combat-enabled') === 'true',
      null,
      { timeout: SOLOMON_RUN_DEADLINE_MS },
    )
  } catch (error) {
    throw new Error(
      `Solomon never ran after contact, so Boneyard combat stayed sealed: ${JSON.stringify(await solomonApproachReceipt(scene))}`,
      { cause: error },
    )
  }
  const admitted = await solomonApproachReceipt(scene)
  assert.ok(admitted.runEventId >= 1, `admission needs Solomon's run event: ${JSON.stringify(admitted)}`)
  return admitted
}
