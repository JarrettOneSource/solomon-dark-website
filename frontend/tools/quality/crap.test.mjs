import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { measureSource } from './source-metrics.mjs'
import { instrumentRenderer } from './instrument.mjs'
import { methodCrap } from './crap.mjs'

test('same-line declaration coverage cannot credit an uncalled arrow body', async () => {
  const file = resolve('renderer-quality-fixture.ts')
  const source = 'export function called() { const never = () => 7; return 1 }'
  const { code } = instrumentRenderer(source, file)
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  assert.equal(module.called(), 1)
  const coverage = globalThis.__coverage__[file]
  const rows = methodCrap(measureSource(source, file), coverage)
  assert.deepEqual(rows.map(row => [row.name, row.coveredLines, row.executableLines, row.score]), [
    ['called', 1, 1, 1], ['never', 0, 1, 2],
  ])
})

test('CRAP uses covered lines within each method and requires an instrumented function', () => {
  const file = resolve('renderer-quality-branch.ts')
  const source = 'function branch(flag) {\n if (flag) {\n return 1\n }\n return 2\n}'
  const metrics = measureSource(source, file)
  const { coverage } = instrumentRenderer(source, file)
  const [row] = methodCrap(metrics, coverage)
  assert.equal(row.cyclomatic, 2)
  assert.equal(row.coveredLines, 0)
  assert.equal(row.score, 6)
  assert.throws(() => methodCrap(metrics, { ...coverage, fnMap: {} }), /Missing function coverage/)
})
