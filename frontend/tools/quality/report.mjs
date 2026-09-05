import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { rendererFiles } from './scope.mjs'

const directory = 'reports/renderer-quality'
const readReport = async name => JSON.parse(await readFile(`${directory}/${name}.json`, 'utf8'))
const staticOnly = process.argv.includes('--static')
const complexity = await readReport('complexity')
const deadCode = await readReport('dead-code/scoped')
const duplication = await readReport('duplication/jscpd-report')
const units = complexity.flatMap(file => file.units)
const sources = {}
for (const file of rendererFiles) sources[file] = await readFile(file, 'utf8')
for (const file of complexity) {
  if (file.sourceHash !== createHash('sha256').update(sources[file.file]).digest('hex')) {
    throw new Error(`Complexity report is stale: ${file.file}`)
  }
}
if (complexity.length !== rendererFiles.length || rendererFiles.some(file => !complexity.some(row => row.file === file))) {
  throw new Error('Complexity report has incomplete scope')
}
const result = {
  measuredAt: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  files: complexity.map(({ file, sourceHash, sourceLines }) => ({ file, sourceHash, sourceLines })),
  maxima: {
    cyclomatic: Math.max(...units.map(unit => unit.cyclomatic)),
    cognitive: Math.max(...units.map(unit => unit.cognitive)),
    halsteadDifficulty: Math.max(...units.map(unit => unit.halstead.difficulty)),
    sourceLines: Math.max(...complexity.map(file => file.sourceLines)),
  },
  prohibitedTypes: complexity.reduce((count, file) => count + file.prohibitedTypes.length, 0),
  deadCode: deadCode.issues.length,
  duplicateBlocks: duplication.duplicates.length,
}
if (!staticOnly) {
  const coverage = await readReport('coverage/coverage-summary')
  const coverageSources = await readReport('coverage/sources')
  const crap = await readReport('crap')
  const mutation = await readReport('mutation/mutation')
  for (const file of result.files) {
    if (coverageSources[file.file] !== file.sourceHash
      || crap.files.find(row => row.file === file.file)?.sourceHash !== file.sourceHash
      || mutation.files[file.file]?.source !== sources[file.file]) {
      throw new Error(`Coverage, CRAP, or mutation report is stale or incomplete: ${file.file}`)
    }
  }
  result.coverage = Object.fromEntries(['statements', 'branches', 'functions', 'lines'].map(name => (
    [name, coverage.total[name]]
  )))
  result.maxima.crap = Math.max(...crap.files.flatMap(file => file.methods.map(method => method.score)))
  result.mutation = {}
  for (const file of Object.values(mutation.files)) {
    for (const mutant of file.mutants) result.mutation[mutant.status] = (result.mutation[mutant.status] ?? 0) + 1
  }
}
const failures = []
for (const [name, limit] of Object.entries({ cyclomatic: 22, cognitive: 22, halsteadDifficulty: 80, sourceLines: 1000, crap: 25 })) {
  if (name === 'crap' && staticOnly) continue
  if (!Number.isFinite(result.maxima[name]) || result.maxima[name] >= limit) failures.push(name)
}
for (const name of ['prohibitedTypes', 'deadCode', 'duplicateBlocks']) {
  if (result[name] !== 0) failures.push(name)
}
if (!staticOnly) {
  if (Object.values(result.coverage).some(metric => metric.pct !== 100)) failures.push('coverage')
  const tested = (result.mutation.Killed ?? 0) + (result.mutation.Timeout ?? 0)
  const untested = Object.keys(result.mutation).filter(status => !['Killed', 'Timeout', 'CompileError'].includes(status))
  if (tested === 0 || untested.length > 0) failures.push('mutation')
}
result.failures = failures
await writeFile(`${directory}/${staticOnly ? 'static-summary' : 'summary'}.json`, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
if (failures.length > 0) process.exitCode = 1
