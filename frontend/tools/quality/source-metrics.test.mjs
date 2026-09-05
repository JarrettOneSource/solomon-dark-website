import assert from 'node:assert/strict'
import test from 'node:test'
import { measureSource } from './source-metrics.mjs'

test('measures each method, nested arrow and same-line callable once', () => {
  const source = `
class Example {
  private value = 1
  #hidden = 2
  constructor(value: number) { this.value = value }
  get total() { return this.value + this.#hidden }
  set total(value: number) { this.value = value }
  run(flag: boolean) { if (flag) return () => flag ? 1 : 0; return () => 0 }
}
const object = { method() { return 1 } }
const first = () => 1; const second = () => 2
`
  const result = measureSource(source, 'fixture.ts')
  assert.equal(result.units.filter(unit => unit.kind === 'field-initializer').length, 2)
  const units = result.units.filter(unit => unit.kind !== 'field-initializer')
  assert.equal(units.length, 9)
  assert.equal(new Set(units.map(unit => unit.range.join(':'))).size, 9)
  assert.equal(units.find(unit => unit.name === 'run').cyclomatic, 2)
  assert.equal(units.find(unit => unit.name === 'run').cognitive, 1)
  const arrows = units.filter(unit => unit.kind === 'ArrowFunctionExpression')
  assert.deepEqual(arrows.map(unit => unit.cyclomatic), [2, 1, 1, 1])
  for (const unit of units) {
    assert.ok(Number.isFinite(unit.halstead.difficulty))
    assert.ok(unit.halstead.operands.total >= unit.halstead.operands.distinct)
  }
})

test('counts default, optional, and nullish decisions and rejects invalid source', () => {
  const report = measureSource('function read(value = null) { return value?.next?.() ?? 0 }', 'optional.ts')
  assert.equal(report.units[0].cyclomatic, 5)
  assert.throws(() => measureSource('function broken(', 'broken.ts'))
  const types = measureSource('function input(a: any, b: unknown) { return a || b }', 'types.ts')
  assert.deepEqual(types.prohibitedTypes.map(type => type.kind), ['TSAnyKeyword', 'TSUnknownKeyword'])
})
