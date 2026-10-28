import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { rendererFiles } from './scope.mjs'
import { measureSource } from './source-metrics.mjs'

const results = []
for (const file of rendererFiles) results.push(measureSource(await readFile(file, 'utf8'), file))
await mkdir('reports/renderer-quality', { recursive: true })
await writeFile('reports/renderer-quality/complexity.json', JSON.stringify(results, null, 2) + '\n')
const failures = []
for (const result of results) {
  if (result.sourceLines >= 1000) failures.push(`${result.file}: ${result.sourceLines} lines`)
  for (const type of result.prohibitedTypes) failures.push(`${result.file}:${type.line}: ${type.kind}`)
  for (const unit of result.units) {
    const location = `${result.file}:${unit.location.start.line} ${unit.name}`
    if (unit.cyclomatic >= 22) failures.push(`${location}: cyclomatic ${unit.cyclomatic}`)
    if (unit.cognitive >= 22) failures.push(`${location}: cognitive ${unit.cognitive}`)
    if (!Number.isFinite(unit.halstead.difficulty) || unit.halstead.difficulty >= 80) {
      failures.push(`${location}: Halstead Difficulty ${unit.halstead.difficulty}`)
    }
  }
}
console.log(JSON.stringify({ files: results.length, functions: results.reduce((count, file) => count + file.units.length, 0), failures }, null, 2))
if (failures.length > 0) process.exitCode = 1
