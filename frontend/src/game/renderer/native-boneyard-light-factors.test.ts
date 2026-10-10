import assert from 'node:assert/strict'
import test from 'node:test'

import * as lighting from '../core-kernels/native-boneyard-light-model.ts'
import { NATIVE_LIGHT_VERTICAL_SCALE } from '../core-kernels/native-boneyard-lighting.ts'
import { writeNativeStaticSurfaceVertexColors } from './boneyard-static-surface-lighting.ts'

// Independent instruction-derived PC24 vectors, ledger052 reopening2026-10-10.
// Fixed expected values come from the sealed scalar oracle, not these helpers.
const vectors = [
  {
    name: 'no-light-zero-ambient',
    position: {x: 0, y: 0},
    sources: [],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'ambient-only-D6-vs-surface',
    position: {x: 0, y: 0},
    sources: [],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0.3},
    radial: 0.30000001192092896, elevated: 0, surface: 0.09000000357627869,
  },
  {
    name: 'ambient-dominates-low-source',
    position: {x: 0, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.20000000298023224}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0.3},
    radial: 0.30000001192092896, elevated: 0.20000000298023224, surface: 0.09000000357627869,
  },
  {
    name: 'r0.6-root',
    position: {x: 0, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r0.6-above',
    position: {x: 0, y: -50},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.4446745812892914, elevated: 0.4446745812892914, surface: 0.1977354884147644,
  },
  {
    name: 'r0.6-below',
    position: {x: 0, y: 50},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.4446745812892914, elevated: 0.21467049419879913, surface: 0.0954585149884224,
  },
  {
    name: 'r0.6-plateau-x',
    position: {x: 45, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r0.6-falloff-x',
    position: {x: 60.000003814697266, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.42954549193382263, elevated: 0.42954549193382263, surface: 0.18450933694839478,
  },
  {
    name: 'r0.6-outer-x',
    position: {x: 87, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r0.6-inner-y',
    position: {x: 0, y: 38.25},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.36258620023727417, surface: 0.21755172312259674,
  },
  {
    name: 'r0.6-outer-y',
    position: {x: 0, y: 73.95000457763672},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r0.6-height-cutoff',
    position: {x: 0, y: 96.66666412353516},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r0.6-diagonal',
    position: {x: 36, y: 28.80000114440918},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.554652214050293, elevated: 0.3894040882587433, surface: 0.21598383784294128,
  },
  {
    name: 'r1-root',
    position: {x: 0, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r1-above',
    position: {x: 0, y: -50},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r1-below',
    position: {x: 0, y: 50},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.2896552085876465, surface: 0.17379313707351685,
  },
  {
    name: 'r1-plateau-x',
    position: {x: 75, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r1-falloff-x',
    position: {x: 100, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.42954549193382263, elevated: 0.42954549193382263, surface: 0.18450933694839478,
  },
  {
    name: 'r1-outer-x',
    position: {x: 145, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r1-inner-y',
    position: {x: 0, y: 63.75},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.204310342669487, surface: 0.1225862130522728,
  },
  {
    name: 'r1-outer-y',
    position: {x: 0, y: 123.25},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r1-height-cutoff',
    position: {x: 0, y: 96.66666412353516},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.31525376439094543, elevated: 0, surface: 0,
  },
  {
    name: 'r1-diagonal',
    position: {x: 60, y: 48},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.554652214050293, elevated: 0.27923867106437683, surface: 0.1548803448677063,
  },
  {
    name: 'r2.6-root',
    position: {x: 0, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r2.6-above',
    position: {x: 0, y: -50},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r2.6-below',
    position: {x: 0, y: 50},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.2896552085876465, surface: 0.17379313707351685,
  },
  {
    name: 'r2.6-plateau-x',
    position: {x: 195, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r2.6-falloff-x',
    position: {x: 260, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.42954549193382263, elevated: 0.42954549193382263, surface: 0.18450933694839478,
  },
  {
    name: 'r2.6-outer-x',
    position: {x: 377, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r2.6-inner-y',
    position: {x: 0, y: 165.75},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0, surface: 0,
  },
  {
    name: 'r2.6-outer-y',
    position: {x: 0, y: 320.45001220703125},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r2.6-height-cutoff',
    position: {x: 0, y: 96.66666412353516},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0, surface: 0,
  },
  {
    name: 'r2.6-diagonal',
    position: {x: 156, y: 124.79999542236328},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.554652214050293, elevated: 0, surface: 0,
  },
  {
    name: 'independent-maxima',
    position: {x: 0, y: 0},
    sources: [{position: {x: 0, y: -80}, radius: 2.5999999046325684, intensity: 0.800000011920929}, {position: {x: 0, y: 1}, radius: 1, intensity: 0.5}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.800000011920929, elevated: 0.5, surface: 0.4000000059604645,
  },
  {
    name: 'independent-maxima-reversed',
    position: {x: 0, y: 0},
    sources: [{position: {x: 0, y: 1}, radius: 1, intensity: 0.5}, {position: {x: 0, y: -80}, radius: 2.5999999046325684, intensity: 0.800000011920929}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.800000011920929, elevated: 0.5, surface: 0.4000000059604645,
  },
  {
    name: 'equal-root-half-source',
    position: {x: 0, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.5}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.5, elevated: 0.5, surface: 0.25,
  },
  {
    name: 'fractional-world-and-camera',
    position: {x: 1256.125, y: 953.375},
    sources: [{position: {x: 1220.375, y: 913.625}, radius: 0.6000000238418579, intensity: 0.550000011920929}, {position: {x: 1310.125, y: 994.75}, radius: 2.5999999046325684, intensity: 0.800000011920929}],
    query: {cameraOrigin: {x: 473.28125, y: 655.625}, ambient: 0},
    radial: 0.800000011920929, elevated: 0.800000011920929, surface: 0.64000004529953,
  },
  {
    name: 'r0.6-boundary75-ulp-1',
    position: {x: 44.999996185302734, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r0.6-boundary75-ulp0',
    position: {x: 45, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r0.6-boundary75-ulp1',
    position: {x: 45.000003814697266, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r0.6-boundary145-ulp-1',
    position: {x: 86.99999237060547, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 1.4305115314527939e-07, elevated: 1.4305115314527939e-07, surface: 2.0463631603042515e-14,
  },
  {
    name: 'r0.6-boundary145-ulp0',
    position: {x: 87, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r0.6-boundary145-ulp1',
    position: {x: 87.00000762939453, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 0.6000000238418579, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r1-boundary75-ulp-1',
    position: {x: 74.99999237060547, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r1-boundary75-ulp0',
    position: {x: 75, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r1-boundary75-ulp1',
    position: {x: 75.00000762939453, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.5999999642372131, elevated: 0.5999999642372131, surface: 0.35999995470046997,
  },
  {
    name: 'r1-boundary145-ulp-1',
    position: {x: 144.99998474121094, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 1.4305115314527939e-07, elevated: 1.4305115314527939e-07, surface: 2.0463631603042515e-14,
  },
  {
    name: 'r1-boundary145-ulp0',
    position: {x: 145, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r1-boundary145-ulp1',
    position: {x: 145.00001525878906, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 1, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r2.6-boundary75-ulp-1',
    position: {x: 194.99998474121094, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r2.6-boundary75-ulp0',
    position: {x: 195, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0.6000000238418579, surface: 0.36000001430511475,
  },
  {
    name: 'r2.6-boundary75-ulp1',
    position: {x: 195.00001525878906, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.5999999642372131, elevated: 0.5999999642372131, surface: 0.35999995470046997,
  },
  {
    name: 'r2.6-boundary145-ulp-1',
    position: {x: 376.9999694824219, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r2.6-boundary145-ulp0',
    position: {x: 377, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'r2.6-boundary145-ulp1',
    position: {x: 377.0000305175781, y: 0},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0, elevated: 0, surface: 0,
  },
  {
    name: 'height-cutoff-ulp-1',
    position: {x: 0, y: 96.666656494140625},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 7.152557657263969e-08, surface: 4.2915345943583816e-08,
  },
  {
    name: 'height-cutoff-ulp0',
    position: {x: 0, y: 96.66666412353516},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0, surface: 0,
  },
  {
    name: 'height-cutoff-ulp1',
    position: {x: 0, y: 96.66667175292969},
    sources: [{position: {x: 0, y: 0}, radius: 2.5999999046325684, intensity: 0.6000000238418579}],
    query: {cameraOrigin: {x: 0, y: 0}, ambient: 0},
    radial: 0.6000000238418579, elevated: 0, surface: 0,
  },
]

for (const vector of vectors) {
  test(`native light factors: ${vector.name}`, () => {
    assert.deepEqual(lighting.nativeBoneyardLightFactors(vector.position, vector.sources, vector.query), {
      radial: vector.radial,
      elevated: vector.elevated,
    })
    assert.equal(lighting.nativeBoneyardLightScalar(vector.position, vector.sources, vector.query), vector.radial)
    assert.equal(lighting.nativeBoneyardSurfaceLightScalar(vector.position, vector.sources, vector.query), vector.surface)
  })
}

test('pins the promoted float32 vertical divisor', () => {
  assert.equal(NATIVE_LIGHT_VERTICAL_SCALE, 0.8500000238418579)
})

test('matches source-array and accepted spatial-index factors with the same camera origin', () => {
  const sources = [
    { castsDirectionalShadow: true, position: { x: 500, y: 420 }, intensity: .8, radius: 2.6 },
    { castsDirectionalShadow: true, position: { x: 500, y: 501 }, intensity: .5, radius: 1 },
  ]
  const index = new lighting.NativeBoneyardLightIndex({ width: 1600, height: 900 })
  index.rebuild(sources, [], { camera: { x: 800, y: 450, zoom: 1 }, viewport: { width: 1600, height: 900 } })
  const query = { cameraOrigin: { x: 73.125, y: -128.625 }, ambient: .1 }
  const point = { x: 500, y: 500 }
  assert.deepEqual(lighting.nativeBoneyardLightFactors(point, index, query), {
    radial: 0.800000011920929, elevated: .5,
  })
  assert.deepEqual(lighting.nativeBoneyardLightFactors(point, index, query),
    lighting.nativeBoneyardLightFactors(point, index.acceptedSources, query))
  assert.equal(lighting.nativeBoneyardLightScalar(point, index, query), 0.800000011920929)
  assert.equal(lighting.nativeBoneyardSurfaceLightScalar(point, index, query), 0.4000000059604645)
})

test('retains float32 camera subtraction before subtracting source query coordinates', () => {
  const point = { x: 470.5591125488281, y: 509.843017578125 }
  const sources = [{ position: { x: 349.40460205078125, y: 511.1286926269531 }, radius: 1, intensity: 0.40911224484443665 }]
  const cameraOrigin = { x: 1252.6041259765625, y: 396.8276672363281 }
  assert.equal(lighting.nativeBoneyardSurfaceLightScalar(point, sources, { cameraOrigin }), 0.028406089171767235)
  assert.equal(lighting.nativeBoneyardSurfaceLightScalar(point, sources), 0.02840602770447731)
})

test('rounds final tint and surface byte multiplication in float32 before truncation', () => {
  for (let byte = 1; byte < 255; byte += 1) {
    const scalar = Math.fround(byte / 255)
    const expected = Math.trunc(Math.fround(scalar * 255))
    assert.equal(lighting.nativeBoneyardLightTint(scalar), expected * 0x010101)
    const colors = new Uint8Array(4)
    assert.equal(writeNativeStaticSurfaceVertexColors(colors, new Float32Array([scalar])), true)
    assert.deepEqual([...colors], [expected, expected, expected, 255])
    assert.equal(writeNativeStaticSurfaceVertexColors(colors, new Float32Array([scalar])), false)
  }
})
