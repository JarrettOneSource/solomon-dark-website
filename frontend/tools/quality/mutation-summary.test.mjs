import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarizeMutations } from './mutation-summary.mjs'

const location = { start: { line: 3, column: 1 }, end: { line: 3, column: 8 } }
const report = (...mutants) => ({ 'renderer.ts': { mutants } })
const killed = { status: 'Killed', mutatorName: 'EqualityOperator', location }

test('reviewed equivalents remain visible without counting as killed mutations', () => {
  const equivalent = {
    status: 'Ignored', mutatorName: 'StringLiteral', location,
    statusReason: 'Equivalent: this resource label only names a GPU diagnostic.',
  }
  const result = summarizeMutations(report(killed, equivalent, { status: 'CompileError' }))
  assert.equal(result.passed, true)
  assert.deepEqual(result.counts, { Killed: 1, Ignored: 1, CompileError: 1 })
  assert.deepEqual(result.equivalents, [{
    file: 'renderer.ts', location, mutator: 'StringLiteral', reason: equivalent.statusReason,
  }])
})

test('behavioral survivors, missing coverage, unfinished runs, and unjustified ignores fail', () => {
  for (const mutant of [
    { status: 'Survived' }, { status: 'NoCoverage' }, { status: 'Pending' },
    { status: 'RuntimeError' }, { status: 'Ignored' },
    { status: 'Ignored', statusReason: 'Equivalent: ' },
    { status: 'Ignored', statusReason: 'Tests will be added later' },
  ]) {
    const result = summarizeMutations(report(killed, mutant))
    assert.equal(result.passed, false, JSON.stringify(mutant))
    assert.equal(result.counts[mutant.status], 1)
  }
})

test('an empty run or only invalid and equivalent mutations cannot pass', () => {
  assert.equal(summarizeMutations({}).passed, false)
  assert.equal(summarizeMutations(report(
    { status: 'CompileError' },
    { status: 'Ignored', statusReason: 'Equivalent: diagnostic text only.' },
  )).passed, false)
})

test('timeouts count as detected mutations and results include every file', () => {
  const result = summarizeMutations({
    ...report(killed), 'surface.ts': { mutants: [{ status: 'Timeout' }, killed] },
  })
  assert.equal(result.passed, true)
  assert.deepEqual(result.counts, { Killed: 2, Timeout: 1 })
})
