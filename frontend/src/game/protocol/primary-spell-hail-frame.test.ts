import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'

import {
  EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS,
  PrimarySpellWaterHailFrameRows,
  maximumPrimarySpellHailFrameBase64Length,
} from './primary-spell-hail-frame.ts'

test('empty packed Hail frames reuse one immutable-size column owner', () => {
  const encoded = EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS.toBase64()
  assert.equal(
    PrimarySpellWaterHailFrameRows.fromBase64(encoded, 16_384),
    EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS,
  )
  assert.equal(EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS.length, 0)
})

test('packed Hail frame columns round-trip every owned scalar without row arrays', () => {
  const rows = PrimarySpellWaterHailFrameRows.create(2)
  rows.ids.set([Number.MAX_SAFE_INTEGER, 2])
  rows.birthTicks.set([8_000_000_000, 9])
  rows.bounceSoundSequences.set([4_000_000_000, 0])
  rows.painterRegistrationOrdinals.set([8_000_000_001, 12])
  rows.bounceProgresses.set([Math.fround(0.4), 1])
  rows.bounceSoundPitches.set([Math.fround(1.2), Number.NaN])
  rows.heights.set([Math.fround(-79.45), -0])
  rows.horizontalVelocityXs.set([Math.fround(4.125), -0])
  rows.horizontalVelocityYs.set([Math.fround(-3.25), 0])
  rows.positionXs.set([Math.fround(1_234.5), Math.fround(-5.25)])
  rows.positionYs.set([Math.fround(-2_345.5), Math.fround(6.5)])
  rows.rotationDegrees.set([Math.fround(359.75), Math.fround(-720.5)])
  rows.rotationStepDegrees.set([Math.fround(10.5), 0])
  rows.savedBounceVelocities.set([Math.fround(-4.75), 0])
  rows.scales.set([Math.fround(0.4), Math.fround(0.6)])
  rows.verticalVelocities.set([Math.fround(19.5), -5])
  rows.transientPositions.set([1, 16_383])
  rows.bounceSoundIndexes.set([3, 0xff])
  rows.ownerIndexes.set([63, 0])
  rows.worldKeyIndexes.set([62, 1])

  const encoded = rows.toBase64()
  const decoded = PrimarySpellWaterHailFrameRows.fromBase64(encoded, 16_384)
  for (const key of [
    'ids',
    'birthTicks',
    'bounceSoundSequences',
    'painterRegistrationOrdinals',
    'bounceProgresses',
    'bounceSoundPitches',
    'heights',
    'horizontalVelocityXs',
    'horizontalVelocityYs',
    'positionXs',
    'positionYs',
    'rotationDegrees',
    'rotationStepDegrees',
    'savedBounceVelocities',
    'scales',
    'verticalVelocities',
    'transientPositions',
    'bounceSoundIndexes',
    'ownerIndexes',
    'worldKeyIndexes',
  ] as const) {
    assert.deepEqual(decoded[key], rows[key])
  }
  assert.equal(decoded.length, 2)
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), { data: encoded })
  assert.deepEqual(structuredClone(rows), { data: encoded })
  assert.equal(encoded.length, maximumPrimarySpellHailFrameBase64Length(2))
})

test('packed Hail frame rejects noncanonical, truncated, extended, and wrong headers', () => {
  const encoded = PrimarySpellWaterHailFrameRows.create(1).toBase64()
  const padded = PrimarySpellWaterHailFrameRows.create(1).toBase64()
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const finalSextetIndex = padded.length - 2
  const finalSextet = alphabet.indexOf(padded[finalSextetIndex]!)
  const nonzeroPadBits = `${padded.slice(0, finalSextetIndex)}${alphabet[finalSextet | 1]}=`
  assert.equal(padded.endsWith('='), true)
  assert.equal(finalSextet & 0x03, 0)
  assert.throws(
    () => PrimarySpellWaterHailFrameRows.fromBase64('', 2),
    /canonical base64/,
  )
  assert.throws(
    () => PrimarySpellWaterHailFrameRows.fromBase64(`${encoded.slice(0, -1)}!`, 1),
    /canonical base64/,
  )
  for (const malformed of [
    `-${padded.slice(1)}`,
    `${padded.slice(0, 4)} ${padded.slice(4)}`,
    padded.slice(0, -1),
    `${padded}=`,
    `${padded.slice(0, 4)}=${padded.slice(5)}`,
    nonzeroPadBits,
  ]) {
    assert.throws(
      () => PrimarySpellWaterHailFrameRows.fromBase64(malformed, 2),
      /canonical base64/,
    )
  }
  assert.throws(
    () => PrimarySpellWaterHailFrameRows.fromBase64(
      mutate(encoded, (bytes) => bytes.writeUInt32LE(0, 0)),
      1,
    ),
    /magic/,
  )
  assert.throws(
    () => PrimarySpellWaterHailFrameRows.fromBase64(
      mutate(encoded, (bytes) => bytes.writeUInt16LE(3, 4)),
      1,
    ),
    /version/,
  )
  assert.throws(
    () => PrimarySpellWaterHailFrameRows.fromBase64(
      Buffer.from(encoded, 'base64').subarray(0, -1).toString('base64'),
      1,
    ),
    /payload length/,
  )
  assert.throws(
    () => PrimarySpellWaterHailFrameRows.fromBase64(
      Buffer.concat([Buffer.from(encoded, 'base64'), Buffer.of(0)]).toString('base64'),
      1,
    ),
    /payload length/,
  )
  assert.throws(
    () => PrimarySpellWaterHailFrameRows.fromBase64(encoded, 0),
    /at most 0 rows/,
  )
})

test('native packed Hail decode uses strict mode and rejects ignored whitespace', () => {
  const constructor = Uint8Array as Uint8ArrayConstructor & {
    fromBase64?: (
      value: string,
      options?: { alphabet?: string; lastChunkHandling?: string },
    ) => Uint8Array
  }
  const original = Object.getOwnPropertyDescriptor(constructor, 'fromBase64')
  let calls = 0
  Object.defineProperty(constructor, 'fromBase64', {
    configurable: true,
    value: (
      value: string,
      options?: { alphabet?: string; lastChunkHandling?: string },
    ) => {
      calls += 1
      assert.deepEqual(options, {
        alphabet: 'base64',
        lastChunkHandling: 'strict',
      })
      return Uint8Array.from(Buffer.from(value.replace(/[\t\n\f\r ]/g, ''), 'base64'))
    },
  })
  try {
    const encoded = PrimarySpellWaterHailFrameRows.create(2).toBase64()
    assert.equal(PrimarySpellWaterHailFrameRows.fromBase64(encoded, 2).length, 2)
    assert.throws(
      () => PrimarySpellWaterHailFrameRows.fromBase64(
        `${encoded.slice(0, 4)}    ${encoded.slice(4)}`,
        2,
      ),
      /canonical base64/,
    )
    assert.equal(calls, 2)
  } finally {
    if (original) Object.defineProperty(constructor, 'fromBase64', original)
    else delete constructor.fromBase64
  }
})

function mutate(encoded: string, change: (bytes: Buffer) => void): string {
  const bytes = Buffer.from(encoded, 'base64')
  change(bytes)
  return bytes.toString('base64')
}
