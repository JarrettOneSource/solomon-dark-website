import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildNativeFlameLashRibbon,
  nativeFlameLashBirthPhase,
  nativeFlameLashFactoryGeometry,
  nativeFlameLashPathPoints,
  nativeFlameLashPrivateSample,
  nativeFlameLashRibbonPairCount,
  nativeFlameLashSplinePoint,
  nativeFlameLashSplineNormal,
} from './native-weld-flame-ribbon.ts'

const base = { start: { x: 0, y: 0 }, control: { x: 20, y: 0 },
  end: { x: 40, y: 0 }, offset: { x: 0, y: 0 }, width: 1,
  weak: false, enhancedEffects: true, phaseDegrees: -3, shortWidthFactor: 1 }

test('Flame branches after extension plus offset and keeps collapsed short membership', () => {
  assert.equal(nativeFlameLashFactoryGeometry({ ...base, end: { x: 59, y: 0 } }).kind, 'short')
  assert.equal(nativeFlameLashFactoryGeometry({ ...base, end: { x: 60, y: 0 } }).kind, 'long')
  assert.equal(nativeFlameLashFactoryGeometry({ ...base, end: { x: 61, y: 0 } }).kind, 'long')
  assert.equal(nativeFlameLashFactoryGeometry({ ...base, end: { x: 60, y: 0 }, offset: { x: -1, y: 0 } }).kind, 'short')
  const flat = { ...base, control: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
  const collapsed = buildNativeFlameLashRibbon(flat)
  assert.equal(collapsed.vertices.length, 12)
  assert.equal(collapsed.indices.length, 12)
  assert.deepEqual(Array.from(collapsed.vertices), Array(12).fill(0))
})

test('short record25 has six vertices, native indices, no caps, and retained width', () => {
  const mesh = buildNativeFlameLashRibbon(base)
  assert.equal(mesh.record, 25)
  assert.deepEqual(Array.from(mesh.indices), [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5])
  // f32(-55 * f32(1/55)) is -0.9999999403953552, not mathematical -1.
  assert.deepEqual(Array.from(mesh.vertices), [0, -32.499996185302734, 0, 32.499996185302734,
    27.5, -32.499996185302734, 27.5, 32.499996185302734, 55, -32.499996185302734, 55, 32.499996185302734])
  assert.deepEqual(Array.from(mesh.colors), Array(6).fill(0xffffffff))
  assert.deepEqual(Array.from(mesh.uvs), [.859375, .728515625, .86865234375, .728515625,
    .859375, .73828125, .86865234375, .73828125, .859375, .728515625, .86865234375, .728515625])
  const weak = buildNativeFlameLashRibbon({ ...base, width: .75, weak: true, shortWidthFactor: .75 })
  assert.deepEqual(Array.from(weak.colors), Array(6).fill(0x7fffffff))
  assert.equal(weak.vertices[1], -18.281248092651367)
})

// The hard numeric fixtures below are static-source equation checks. Their
// expected stores were independently evaluated with struct-packed float32
// arithmetic, not captured by executing the retail game. They make no claim
// about every x87/CRT halfway-rounding case or whole-process RNG equivalence.
const floatWords = (values: Float32Array) => Array.from(new Uint32Array(
  values.buffer, values.byteOffset, values.length,
))

test('three-point spline keeps the named forward/backward/coefficient and normal stores', () => {
  const points = [{ x: 10001.123, y: -.271 }, { x: 10078.456, y: 53.817 },
    { x: 10230.789, y: -125.419 }] as const
  const fixtures = [
    { t: -.1, point: { x: 10001.123046875, y: -.2709999978542328 },
      normal: { x: .9312708377838135, y: -.364327609539032 } },
    { t: .375123, point: { x: 10016.7822265625, y: 32.37139129638672 },
      normal: { x: .8435462713241577, y: -.5370564460754395 } },
    { t: 1, point: { x: 10078.4560546875, y: 53.81700134277344 },
      normal: { x: -.4837181270122528, y: -.8752237558364868 } },
    { t: 1.750123, point: { x: 10203.001953125, y: -85.79475402832031 },
      normal: { x: -.8115497827529907, y: -.5842833518981934 } },
    { t: 2, point: { x: 10230.7890625, y: -125.41899108886719 },
      normal: { x: -.8223335146903992, y: -.5690058469772339 } },
  ]
  for (const fixture of fixtures) {
    assert.deepEqual(nativeFlameLashSplinePoint(points, fixture.t), fixture.point)
    assert.deepEqual(nativeFlameLashSplineNormal(points, fixture.t), fixture.normal)
  }
  assert.deepEqual(nativeFlameLashSplinePoint(points, 9), fixtures.at(-1)!.point)
  assert.deepEqual(nativeFlameLashSplineNormal(points, 9), { x: 0, y: 0 })
})

test('signed private stream pins negative remainder, odd sign, and signed-abs INT_MIN', () => {
  const fixtures = [
    [-3, -.0005416666390374303, .4092499911785126, 1933679868],
    [1, -.0001805555511964485, 1.5456805229187012, 1494831964],
    [-360001, .0001805555511964485, 4.7730278968811035, 1492677334],
    [-2147483648, -15.103111267089844, .35822221636772156, 1879773625],
    // mix(-1072692736) is INT_MIN: abs must retain its signed representation.
    [-1072692736, -45.63288879394531, 4.71999979019165, 1456225792],
  ] as const
  for (const [state, angleDegrees, radius, nextState] of fixtures) {
    assert.deepEqual(nativeFlameLashPrivateSample(state), { angleDegrees, radius, nextState })
  }
  // Signed integer 2147483647 rounds up on the subsequent float32 store.
  assert.equal(nativeFlameLashBirthPhase(0x2aaaaaab), 2147483648)
})

const curved = { ...base, start: { x: 13.125, y: -17.5 }, control: { x: 72.375, y: 34.125 },
  end: { x: 190.25, y: -48.75 }, offset: { x: -5, y: -20 }, width: .625,
  phaseDegrees: -1234.25, shortWidthFactor: null }

test('curved coarse ribbon pins all stored coordinates, cap order and native phase waves', () => {
  const mesh = buildNativeFlameLashRibbon({ ...curved, enhancedEffects: false })
  assert.deepEqual(floatWords(mesh.parameters), [0, 1056964608, 1065353216, 1073741824])
  assert.deepEqual(floatWords(mesh.vertices), [
    1107961178, 3259841886, 3250879400, 3254238604,
    1113602356, 3217978928, 1101129164, 1103937163,
    1116180245, 1099377102, 1117466339, 1111114385,
    1127097436, 3267639858, 1130161728, 3261239348,
  ])
  assert.equal(nativeFlameLashRibbonPairCount(nativeFlameLashFactoryGeometry(curved), false), 4)
})

test('curved Enhanced ribbon pins first-leg spacing7 and every float32 parameter increment', () => {
  const mesh = buildNativeFlameLashRibbon(curved)
  assert.deepEqual(floatWords(mesh.parameters), [0, 1043737290, 1052125898, 1057529880,
    1060514506, 1063499132, 1065918487, 1067410800, 1068903113, 1070395426, 1071887739, 1073741824])
  assert.deepEqual(floatWords(mesh.vertices), [
    1107961178, 3259841886, 3250879400, 3254238604,
    1110871748, 3247608844, 3245282842, 1085836596,
    1111529949, 3233224017, 1067291200, 1100744415,
    1114255172, 3211380528, 1103828900, 1104616398,
    1115304798, 3209807008, 1110647894, 1106492812,
    1114929143, 1091722794, 1114955165, 1109682378,
    1117024678, 1100204835, 1118863558, 1111147466,
    1119991885, 1085765600, 1122767391, 1107612424,
    1122105026, 3250940464, 1124924930, 1085440480,
    1124187044, 3261101616, 1126561394, 3248875845,
    1125678542, 3265209125, 1128679798, 3256225378,
    1127097436, 3267639858, 1130161728, 3261239348,
  ])
  assert.equal(nativeFlameLashRibbonPairCount(nativeFlameLashFactoryGeometry(curved), true), 12)
  assert.equal(mesh.indices.length, 66)
  assert.equal(Math.max(...mesh.indices), mesh.vertices.length / 2 - 1)
})

test('factory path and split bounds exclude body offset and use extended endpoint', () => {
  const geometry = nativeFlameLashFactoryGeometry(curved)
  assert.deepEqual(geometry.extendedEnd, { x: 202.52072143554688, y: -57.37724304199219 })
  assert.deepEqual(geometry.bodyEnd, { x: 197.52072143554688, y: -77.37724304199219 })
  assert.equal(geometry.span, 193.87384033203125)
  assert.deepEqual(geometry.splitBounds, {
    x: -86.875, y: -157.3772430419922, width: 389.3957214355469, height: 291.50225830078125,
  })
  const long = { ...base, control: { x: 250, y: 0 }, end: { x: 500, y: 0 } }
  const plain = nativeFlameLashFactoryGeometry(long)
  const offset = nativeFlameLashFactoryGeometry({ ...long, offset: { x: -500, y: 9 } })
  assert.equal(plain.kind, 'long')
  assert.equal(offset.kind, 'short')
  assert.deepEqual(nativeFlameLashPathPoints(plain), nativeFlameLashPathPoints(offset))
  assert.deepEqual(plain.splitBounds, offset.splitBounds)
  const flat = nativeFlameLashFactoryGeometry({ ...base, control: base.start, end: base.start })
  assert.deepEqual(flat.extendedEnd, base.start)
  assert.deepEqual(flat.splitBounds, { x: -100, y: -100, width: 201, height: 201 })
  assert.deepEqual(nativeFlameLashPathPoints(flat), [])
})

test('path strict remaining50/150 and inclusive distance220 keep exact membership', () => {
  const points = (endX: number, middleX: number) => nativeFlameLashPathPoints(
    nativeFlameLashFactoryGeometry({ ...base, control: { x: middleX, y: 0 }, end: { x: endX, y: 0 } }),
  )
  assert.deepEqual(points(385, 350), [{ x: 350, y: 35 }, { x: 400, y: 35 }])
  assert.deepEqual(points(485, 350), [{ x: 350, y: 35 }, { x: 350, y: 35 }, { x: 500, y: 35 }])
  assert.deepEqual(points(204.999, 100), [])
  assert.deepEqual(points(205, 100), [{ x: 220, y: 35 }])
})

test('primary wave saturates at stored span250 and short ignores the supplied control', () => {
  const atSpan = (span: number) => buildNativeFlameLashRibbon({ ...base, control: { x: 100, y: 0 },
    end: { x: span - 15, y: 0 }, phaseDegrees: 90, enhancedEffects: false, shortWidthFactor: null })
  const below = atSpan(249.999)
  const at = atSpan(250)
  const above = atSpan(250.001)
  // The t=1 pair sits at the same M; only the primary amplitude can differ.
  assert.notEqual(below.vertices[9], at.vertices[9])
  assert.deepEqual(Array.from(at.vertices.slice(8, 12)), Array.from(above.vertices.slice(8, 12)))
  assert.deepEqual(buildNativeFlameLashRibbon(base),
    buildNativeFlameLashRibbon({ ...base, control: { x: -100, y: 0 } }))
})

test('geometry admission rejects missing retained width and bounded resource overflow', () => {
  assert.throws(() => buildNativeFlameLashRibbon({ ...base, shortWidthFactor: null }), /retained birth width/)
  assert.throws(() => nativeFlameLashFactoryGeometry({ ...base, end: { x: Infinity, y: 0 } }), /finite/)
  const geometry = nativeFlameLashFactoryGeometry(curved)
  assert.throws(() => nativeFlameLashRibbonPairCount(geometry, true, 11), /pair budget/)
  assert.equal(nativeFlameLashRibbonPairCount(geometry, true, 12), 12)
  assert.throws(() => nativeFlameLashRibbonPairCount(geometry, true, 0), /budget/)
  const huge = nativeFlameLashFactoryGeometry({ ...base, control: { x: 20_000_000, y: 0 }, end: { x: 40_000_000, y: 0 } })
  assert.throws(() => nativeFlameLashRibbonPairCount(huge, true), /pair budget/)
  const manyPoints = nativeFlameLashFactoryGeometry({ ...base, control: { x: 250, y: 0 }, end: { x: 500, y: 0 } })
  assert.throws(() => nativeFlameLashPathPoints(manyPoints, 4), /point budget/)
  assert.equal(nativeFlameLashPathPoints(manyPoints, 5).length, 5)
})

for (const [role, width, weak] of [['normal', 1, false], ['weak', .75, true], ['chain', .625, false]] as const) {
  for (const enhancedEffects of [false, true]) {
    for (const short of [false, true]) {
      test(`${role} ${enhancedEffects ? 'Enhanced' : 'coarse'} ${short ? 'short' : 'long'} retains record25 membership`, () => {
        const input = { ...(short ? base : curved), width, weak, enhancedEffects }
        const mesh = buildNativeFlameLashRibbon(input)
        assert.equal(mesh.record, 25)
        assert.equal(mesh.kind, short ? 'short' : 'long')
        assert.ok(mesh.indices instanceof Uint16Array)
        assert.equal('branch' in mesh, false)
        for (let pair = 0; pair < mesh.parameters.length; pair += 1) {
          const edge = pair === 0 || pair === mesh.parameters.length - 1
          const expectedColor = !short && edge ? 0 : weak ? 0x7fffffff : 0xffffffff
          assert.equal(mesh.colors[pair * 2], expectedColor)
          assert.equal(mesh.colors[pair * 2 + 1], expectedColor)
          assert.equal(mesh.uvs[pair * 4 + 1], edge ? .728515625 : .73828125)
          assert.equal(mesh.uvs[pair * 4 + 3], edge ? .728515625 : .73828125)
        }
        assert.equal(mesh.vertices.length / 2, mesh.colors.length)
        assert.equal(mesh.indices.length, (mesh.parameters.length - 1) * 6)
      })
    }
  }
}

test('long step .5 uses 0,.5,1,2 with transparent caps and native first backshift', () => {
  const mesh = buildNativeFlameLashRibbon({ ...base, control: { x: 0, y: 0 }, end: { x: 100, y: 0 }, shortWidthFactor: null })
  assert.deepEqual(Array.from(mesh.parameters), [0, .5, 1, 2])
  assert.deepEqual(Array.from(mesh.colors), [0, 0, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0, 0])
  assert.equal(mesh.indices.length, 18)
  for (let i = 2; i < mesh.colors.length - 2; i += 1) assert.equal(mesh.uvs[i * 2 + 1], .73828125)
  assert.equal(mesh.uvs.at(-1), .728515625)
  assert.ok(Math.abs(mesh.vertices[0]!) === 25)
  assert.equal(mesh.vertices.at(-2), 115)
})

test('spline clamps final parameter and native coincident normals stay zero', () => {
  const points = [{ x: 5, y: 7 }, { x: 5, y: 7 }, { x: 5, y: 7 }] as const
  assert.deepEqual(nativeFlameLashSplineNormal(points, 0), { x: 0, y: 0 })
  assert.deepEqual(nativeFlameLashSplinePoint(points, -1), points[0])
  assert.deepEqual(nativeFlameLashSplinePoint(points, 2), points[2])
  assert.deepEqual(nativeFlameLashSplinePoint(points, 9), points[2])
})

test('phase is signed int32 before float conversion and private sampling is independent of actor ID', () => {
  assert.equal(nativeFlameLashBirthPhase(0), 0)
  assert.equal(nativeFlameLashBirthPhase(1), -3)
  assert.equal(nativeFlameLashBirthPhase(0x80000000), -2147483648)
  assert.equal(nativeFlameLashBirthPhase(0xffffffff), 3)
  assert.deepEqual(nativeFlameLashPrivateSample(0), { angleDegrees: 0, radius: 0, nextState: 0 })
  assert.ok(Number.isFinite(nativeFlameLashPrivateSample(-2147483648).radius))
  const input = { ...base, end: { x: 300, y: 40 }, control: { x: 150, y: 15 }, shortWidthFactor: null }
  assert.deepEqual(buildNativeFlameLashRibbon({ ...input, id: 1 } as typeof input),
    buildNativeFlameLashRibbon({ ...input, id: 999 } as typeof input))
})

test('path points retain two-leg order, duplicate midpoint and distance220 admission', () => {
  const geometry = nativeFlameLashFactoryGeometry({ ...base, control: { x: 250, y: 0 }, end: { x: 500, y: 0 } })
  assert.deepEqual(nativeFlameLashPathPoints(geometry), [
    { x: 250, y: 35 }, { x: 250, y: 35 }, { x: 350, y: 35 }, { x: 450, y: 35 }, { x: 515, y: 35 },
  ])
  const at220 = nativeFlameLashFactoryGeometry({ ...base, control: { x: 100, y: 0 }, end: { x: 205, y: 0 } })
  assert.deepEqual(nativeFlameLashPathPoints(at220), [{ x: 220, y: 35 }])
})
