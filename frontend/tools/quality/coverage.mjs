import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import istanbulCoverage from 'istanbul-lib-coverage'
import istanbulReport from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import { rendererFiles, rendererTests } from './scope.mjs'
import { instrumentRenderer } from './instrument.mjs'

const { createCoverageMap } = istanbulCoverage
const { createContext } = istanbulReport

const directory = resolve('reports/renderer-quality/coverage')
await rm(directory, { recursive: true, force: true })
await mkdir(`${directory}/raw`, { recursive: true })
const coverage = createCoverageMap({})
for (const file of rendererFiles) {
  const source = await readFile(file, 'utf8')
  coverage.addFileCoverage(instrumentRenderer(source, file).coverage)
}
for (const args of [
  ['--import', './tools/quality/coverage-hook.mjs', '--experimental-strip-types', '--test', ...rendererTests],
  ['tools/smoke-native-render-materials.mjs', '--coverage'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Coverage tests failed: ${args.join(' ')}`)
}
for (const file of await readdir(`${directory}/raw`)) {
  coverage.merge(JSON.parse(await readFile(`${directory}/raw/${file}`, 'utf8')))
}
const context = createContext({ dir: directory, coverageMap: coverage })
for (const reporter of ['json', 'json-summary', 'text', 'html']) {
  reports.create(reporter).execute(context)
}
const summaries = Object.fromEntries(rendererFiles.map(file => [
  file, coverage.fileCoverageFor(resolve(file)).toSummary().data,
]))
await writeFile(`${directory}/summary.json`, JSON.stringify(summaries, null, 2) + '\n')
const failed = Object.entries(summaries).filter(([, metrics]) => (
  ['statements', 'branches', 'functions', 'lines'].some(name => metrics[name].pct !== 100)
))
if (failed.length > 0) {
  console.error('Renderer coverage below 100%:', failed.map(([file]) => file).join(', '))
  process.exitCode = 1
}
