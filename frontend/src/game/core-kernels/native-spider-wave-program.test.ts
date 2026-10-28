import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createBoneyardWaveDirector,
  startBoneyardWaveDirector,
  stepBoneyardWaveDirector,
} from './boneyard-wave-director.ts'

const SOURCE = '8c2f97d2ed54431987e3cb54b7ae3c1098bf1c4517f59ade6aea57759187adb0'

test('retail wave four runs its Tiny Spider script and holds ordinary births', () => {
  let director = {
    ...startBoneyardWaveDirector(createBoneyardWaveDirector('spider-regression', undefined, {
      sourceSha256: SOURCE,
    })),
    waveOrdinal: 4,
  }
  const births = []
  for (let tick = 0; tick < 250; tick += 1) {
    const result = stepBoneyardWaveDirector(director, {
      bounds: { x: 0, y: 0, w: 1_000, h: 1_000, left: 0, top: 0, right: 1_000, bottom: 1_000 },
      liveEnemyCount: births.length,
      liveZombieCount: 0,
      players: { player: { position: { x: 500, y: 500 } } },
      tick,
    })
    births.push(...result.spawnIntents)
    director = result.director
  }
  assert.deepEqual(births.map(({ nativeTypeId }) => nativeTypeId), [2057, 2057, 2057])
  assert.equal(director.waveOrdinal, 4)
})

import { NATIVE_SPIDER_WAVES } from './native-spider-wave-data.ts'
import { createNativeSpiderWaveState, stepNativeSpiderWaves } from './native-spider-wave-program.ts'

// Independent expectations from the archived serialized trigger/script operands.
const sourcePhases = [
  ["2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f",0,7,36804,36803,[[4,[]],[6,[]]]],
  ["9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9",0,6,36805,36804,[[2,[]]]],
  ["9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9",1,11,36807,36806,[[4,[]],[6,[]]]],
  ["bd3c38468481b7337b1e7382e5503cc214356906571763a68188b23e821e73fb",0,11,35003,35002,[[4,[]],[6,[]]]],
  ["bd3c38468481b7337b1e7382e5503cc214356906571763a68188b23e821e73fb",1,27,35015,35014,[[6,[1,1,43]],[7,[1,1,43]],[4,[1,1,43,43,3]]]],
  ["8c2f97d2ed54431987e3cb54b7ae3c1098bf1c4517f59ade6aea57759187adb0",0,4,37314,37313,[[3,[]]]],
  ["8c2f97d2ed54431987e3cb54b7ae3c1098bf1c4517f59ade6aea57759187adb0",1,7,37316,37315,[[4,[]],[6,[]]]],
  ["bec9377cf539bb193e8af6ad72fa78a5e47e44206a1fef4d6bf3bfbda3f04a08",0,10,36821,36820,[[4,[]],[6,[]]]],
  ["bec9377cf539bb193e8af6ad72fa78a5e47e44206a1fef4d6bf3bfbda3f04a08",1,28,36833,36832,[[6,[1,1,43]],[7,[1,1,43]],[3,[1,1,43,43,3]]]],
  ["ec2b27a1415c944c233158da8c21324760cd896e1228143aa18d262f65fa2a45",0,12,37376,37375,[[4,[]],[6,[]]]],
  ["ec2b27a1415c944c233158da8c21324760cd896e1228143aa18d262f65fa2a45",1,29,37388,37387,[[6,[1,1,43]],[10,[1,1,43]],[3,[1,1,43,43,3]]]],
  ["624b79ae325daa714b24017e0a308c64519f7481eb206e4489968217b1a2e123",0,8,37385,37384,[[4,[]],[6,[]]]],
  ["e62e5e847562d822382fba14709d5367c9cd7de40f8b4fa52ecea3bfc8d9a430",0,12,37376,37375,[[4,[]],[6,[]]]],
  ["e62e5e847562d822382fba14709d5367c9cd7de40f8b4fa52ecea3bfc8d9a430",1,40,37391,37390,[[15,[1,1,43]],[7,[1,1,5,43]],[13,[1,1,43,43,3,1,5,5,43]]]],
  ["506200e6f89dd26150c7fcc76f5cddfdb321412657ac979ea5924b567b4a2933",0,11,37464,37463,[[4,[]],[6,[]]]],
  ["506200e6f89dd26150c7fcc76f5cddfdb321412657ac979ea5924b567b4a2933",1,47,37479,37478,[[15,[1,1,43]],[8,[1,1,5,43]],[15,[1,1,43,43,3,1,5,5,43]]]],
  ["cd4d1ba948ca6624fffb967b02b7c93a6d00cbf9b5ec2c4541330b0616a1c239",0,4,37352,37351,[[3,[]]]],
  ["cd4d1ba948ca6624fffb967b02b7c93a6d00cbf9b5ec2c4541330b0616a1c239",1,12,37354,37353,[[4,[]],[6,[]]]],
  ["efa240ce741df0f781228206d024bb1903c7210d1163eccf80c87e835365422f",0,11,37328,37327,[[4,[]],[6,[]]]],
  ["efa240ce741df0f781228206d024bb1903c7210d1163eccf80c87e835365422f",1,43,37339,37338,[[12,[1,1,43]],[8,[1,1,5,43]],[13,[1,1,43,43,3,1,5,5,43]]]],
  ["1be4c308ccd442d70060cc66e3daa7b073faf035fd92d6b49fad4c33a91ef0c1",0,12,37390,37389,[[4,[]],[6,[]]]],
  ["1be4c308ccd442d70060cc66e3daa7b073faf035fd92d6b49fad4c33a91ef0c1",1,34,37402,37401,[[6,[1,1,43]],[8,[1,1,43]],[3,[1,1,43,43,3]]]],
  ["1be4c308ccd442d70060cc66e3daa7b073faf035fd92d6b49fad4c33a91ef0c1",2,49,37407,37406,[[13,[1,1,43]],[6,[1,1,5,43]],[13,[1,1,43,43,3,1,5,5,43]]]],
] as const
const nativeFlags = { 1: 'FLAG_HPUP', 3: 'FLAG_STRONG', 5: 'FLAG_FAST', 43: 'FLAG_COCOON' } as const

for (const [source, phaseIndex, wave, triggerUid, scriptUid, groups] of sourcePhases) {
  test(`retail ${source.slice(0, 6)} wave ${wave} retains every Spider birth, flag and completion edge`, () => {
    const definitions = NATIVE_SPIDER_WAVES[source]!
    const definition = definitions[phaseIndex]!
    assert.equal(definition.startWave, wave)
    assert.equal(definition.triggerUid, triggerUid)
    assert.equal(definition.scriptUid, scriptUid)
    let state = { ...createNativeSpiderWaveState(), phaseIndex }
    const before = stepNativeSpiderWaves(state, definitions, wave - 1, 0)
    assert.deepEqual(before.births, [])
    assert.equal(before.state.active, false)
    const births = []
    let liveCount = 0
    let lastBirthTick = -1
    let advances = 0
    let observedPause = false
    for (let tick = 0; tick < 2_000 && state.phaseIndex === phaseIndex; tick += 1) {
      if (liveCount > 0 && tick - lastBirthTick > 230) liveCount = 0
      const result = stepNativeSpiderWaves(state, definitions, wave, liveCount)
      if (result.advanceWave) { assert.equal(liveCount, 0); advances += 1 }
      if (result.births.length > 0) {
        lastBirthTick = tick
        liveCount += result.births.length
        births.push(...result.births)
      }
      observedPause ||= result.state.timelinePaused
      state = result.state
    }
    assert.equal(observedPause, true)
    assert.equal(advances, 1)
    assert.equal(state.phaseIndex, phaseIndex + 1)
    assert.equal(state.timelinePaused, false)
    assert.deepEqual(births.map(birth => birth.flags), groups.flatMap(([count, flags]) => (
      Array.from({ length: count }, () => flags.map(flag => nativeFlags[flag]))
    )))
    assert.ok(births.every(birth => birth.positionPolicy === 'offscreen'))
  })
}
