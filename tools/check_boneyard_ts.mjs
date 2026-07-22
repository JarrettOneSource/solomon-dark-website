#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { newBoneyard, parseBoneyard, serializeBoneyard } from '../frontend/src/editor/format/boneyard.ts'

const here = dirname(fileURLToPath(import.meta.url))
const solomonDark = resolve(here, '../..')
const fixture = join(solomonDark, 'Mod Loader/tests/fixtures/boneyards/flat_multiplayer_test.boneyard')
const files = process.argv.length > 2
  ? process.argv.slice(2).map((path) => resolve(path))
  : [
      join(solomonDark, 'SolomonDarkAbandonware/data/levels/story0.boneyard'),
      join(solomonDark, 'SolomonDarkAbandonware/data/levels/story1.boneyard'),
      join(solomonDark, 'SolomonDarkAbandonware/data/levels/survival.boneyard'),
      join(solomonDark, 'SolomonDarkAbandonware/data/levels/tutorial.boneyard'),
      join(solomonDark, 'SolomonDarkAbandonware/sandbox/play.boneyard'),
      fixture,
      join(solomonDark, 'SolomonDarkAbandonware/sandbox/DarkCloud/mylevels/New Boneyard 1.boneyard'),
    ]

function identical(left, right) {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return false
  return true
}

let failed = false
console.log(`${'FILE'.padEnd(46)} ${'BYTES'.padStart(10)}  RESULT`)
for (const path of files) {
  try {
    const source = new Uint8Array(await readFile(path))
    const rebuilt = serializeBoneyard(parseBoneyard(source))
    const okay = identical(source, rebuilt)
    failed ||= !okay
    const result = okay ? 'byte-identical' : `DIFF rebuilt=${rebuilt.length}`
    console.log(`${path.split(/[\\/]/).at(-1).padEnd(46)} ${String(source.length).padStart(10)}  ${result}`)
  } catch (error) {
    failed = true
    console.log(`${path.split(/[\\/]/).at(-1).padEnd(46)} ${'-'.padStart(10)}  ERROR ${error.message}`)
  }
}

try {
  const fixtureBytes = new Uint8Array(await readFile(fixture))
  const authored = newBoneyard('TypeScript Smoke Test', fixtureBytes)
  const rebuilt = serializeBoneyard(authored)
  const reparsed = parseBoneyard(rebuilt)
  const okay = reparsed.meta.name === 'TypeScript Smoke Test'
    && reparsed.objects.length === 0
    && reparsed.timeline.records.length === 1
  failed ||= !okay
  console.log(`${'newBoneyard smoke'.padEnd(46)} ${String(rebuilt.length).padStart(10)}  ${okay ? 'valid' : 'FAILED'}`)
} catch (error) {
  failed = true
  console.log(`${'newBoneyard smoke'.padEnd(46)} ${'-'.padStart(10)}  ERROR ${error.message}`)
}

try {
  const fixtureBytes = new Uint8Array(await readFile(fixture))
  const authored = newBoneyard('TypeScript Authoring Test', fixtureBytes)
  authored.objects = [
    { eid: 'tree', typeId: 2001, pos: { x: 100, y: 100 }, variant: 2, secondaryVariant: 1, secondaryVisible: true },
    { eid: 'monument', typeId: 2009, pos: { x: 200, y: 200 }, variant: 3 },
    { eid: 'gravestone', typeId: 2029, pos: { x: 300, y: 300 }, variant: 4, overlayVariant: 2, tint: { r: 1, g: 0.5, b: 0.25, a: 1 } },
    { eid: 'building', typeId: 2040, pos: { x: 400, y: 400 }, variant: 1 },
    { eid: 'goodie', typeId: 2061, pos: { x: 500, y: 500 }, subtype: 0, phase: 0, active: false, timer: 0, rewardSeed: 12345 },
  ]
  authored.roads = [{ eid: 'road', typeId: 3004, points: [{ x: 50, y: 700 }, { x: 500, y: 700 }], style: 2, startWidthScale: 1.25, endWidthScale: 0.75 }]
  authored.fences = [{ eid: 'fence', typeId: 3005, points: [{ x: 50, y: 800 }, { x: 500, y: 800 }], segmentCode: 2, startPostVariant: 2, endPostVariant: 4 }]
  authored.terrain = [{ eid: 'terrain', typeId: 3009, pos: { x: 50, y: 900 }, points: [{ x: 50, y: 900 }, { x: 200, y: 940 }, { x: 400, y: 920 }], style: 1, profileSamples: [1, 0.8, 1.2], sideSign: -1 }]
  authored.sprites = [{ eid: 'sprite', atlasEntry: 7, pos: { x: 600, y: 600 }, rotationDeg: 15, scale: 1.25, alpha: 0.75, s0: 15, s1: 1.25, s2: 0.75, flags: 3 }]
  authored.recipes.monsters = [{ typeId: 6001, enemyType: 1001, name: 'Authored Skeleton', uid: 51000, maxHp: 10, primaryDamage: 2, chaseSpeed: 1, moveSpeedScale: 1, archetype: 'SKELETON' }]
  authored.recipes.uidGroups = [{ typeId: 6002, name: 'Authored Group', uid: 51001, memberUids: [51000], fields58: [0, 0, 0], field34: 0 }]
  const rebuilt = serializeBoneyard(authored)
  const reparsed = parseBoneyard(rebuilt)
  const okay = reparsed.objects.length === 5
    && reparsed.objects.find((item) => item.typeId === 2061)?.rewardSeed === 12345
    && reparsed.roads.length === 1
    && reparsed.fences[0]?.segmentCode === 2
    && reparsed.terrain.length === 1
    && reparsed.sprites[0]?.deadHawgEntry === 121
    && reparsed.recipes.monsters[0]?.name === 'Authored Skeleton'
    && reparsed.recipes.uidGroups[0]?.memberUids?.[0] === 51000
    && identical(rebuilt, serializeBoneyard(reparsed))
  failed ||= !okay
  console.log(`${'authoring smoke'.padEnd(46)} ${String(rebuilt.length).padStart(10)}  ${okay ? 'byte-identical' : 'FAILED'}`)
} catch (error) {
  failed = true
  console.log(`${'authoring smoke'.padEnd(46)} ${'-'.padStart(10)}  ERROR ${error.message}`)
}

process.exitCode = failed ? 1 : 0
