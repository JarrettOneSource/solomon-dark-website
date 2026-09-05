import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { rendererFiles } from './scope.mjs'

const result = spawnSync('node_modules/.bin/knip', [
  '--config', 'knip.renderer.json', '--production',
  '--include', 'files,exports,types,enumMembers,duplicates,unresolved', '--reporter', 'json',
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
if (result.error) throw result.error
if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr)
const report = JSON.parse(result.stdout)
const issues = report.issues.filter(issue => rendererFiles.includes(issue.file))
await mkdir('reports/renderer-quality/dead-code', { recursive: true })
await writeFile('reports/renderer-quality/dead-code/knip.json', result.stdout)
await writeFile('reports/renderer-quality/dead-code/scoped.json', JSON.stringify({ files: rendererFiles, issues }, null, 2) + '\n')
console.log(JSON.stringify({ analyzedGraph: 'production application and game host', scopedFiles: rendererFiles.length, issues }, null, 2))
if (issues.length > 0) process.exitCode = 1
