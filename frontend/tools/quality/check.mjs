import { spawnSync } from 'node:child_process'

const staticOnly = process.argv.includes('--static')
const commands = [
  ['--test', 'tools/quality/source-metrics.test.mjs', 'tools/quality/crap.test.mjs'],
  ['tools/quality/complexity.mjs'],
  ['tools/quality/dead-code.mjs'],
  ['tools/quality/duplication.mjs'],
]
if (!staticOnly) commands.push(
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json', '--noEmit'],
  ['tools/quality/coverage.mjs'],
  ['tools/quality/crap.mjs'],
  ['node_modules/@stryker-mutator/core/bin/stryker.js', 'run', 'stryker.renderer.config.mjs'],
)
commands.push(['tools/quality/report.mjs', ...(staticOnly ? ['--static'] : [])])

for (const args of commands) {
  console.log(`Renderer quality: node ${args.join(' ')}`)
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exitCode = 1
}
