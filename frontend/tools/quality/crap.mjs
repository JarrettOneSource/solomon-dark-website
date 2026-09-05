import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function methodCrap(sourceMetrics, coverage) {
  const callables = sourceMetrics.units.filter(unit => unit.kind !== 'field-initializer')
  const rows = callables.map(unit => ({ unit, lines: new Map(), measuredFunction: false }))
  const before = (left, right) => left.line < right.line || (left.line === right.line && left.column <= right.column)
  const contains = (outer, inner) => before(outer.start, inner.start) && before(inner.end, outer.end)
  const smallest = (location, bodyOnly = false) => rows.filter(row => contains(bodyOnly ? row.unit.body : row.unit.location, location))
    .sort((a, b) => a.unit.range[1] - a.unit.range[0] - (b.unit.range[1] - b.unit.range[0]))[0]
  for (const declaration of Object.values(coverage.fnMap)) {
    const owner = smallest(declaration.loc)
    if (!owner) throw new Error(`Unmatched instrumented function in ${sourceMetrics.file}`)
    owner.measuredFunction = true
  }
  for (const [id, location] of Object.entries(coverage.statementMap)) {
    const owner = smallest(location, true)
    if (!owner) continue // Module initialization is outside every method.
    const line = location.start.line
    owner.lines.set(line, Boolean(owner.lines.get(line)) || coverage.s[id] > 0)
  }
  return rows.map(({ unit, lines, measuredFunction }) => {
    if (!measuredFunction) throw new Error(`Missing function coverage in ${sourceMetrics.file}:${unit.location.start.line}`)
    const total = lines.size
    const covered = [...lines.values()].filter(Boolean).length
    const fraction = total === 0 ? 1 : covered / total
    return {
      name: unit.name, location: unit.location, cyclomatic: unit.cyclomatic,
      executableLines: total, coveredLines: covered,
      score: unit.cyclomatic ** 2 * (1 - fraction) ** 3 + unit.cyclomatic,
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = 'reports/renderer-quality'
  const complexity = JSON.parse(await readFile(`${directory}/complexity.json`, 'utf8'))
  const coverage = JSON.parse(await readFile(`${directory}/coverage/coverage-final.json`, 'utf8'))
  const files = complexity.map(file => {
    const covered = coverage[resolve(file.file)]
    if (!covered) throw new Error(`Coverage was not collected for ${file.file}`)
    return { file: file.file, methods: methodCrap(file, covered) }
  })
  await writeFile(`${directory}/crap.json`, JSON.stringify({ variant: 'CRAP using method line coverage and the original formula', files }, null, 2) + '\n')
  const failures = files.flatMap(file => file.methods.filter(method => method.score >= 25).map(method => ({ file: file.file, ...method })))
  console.log(JSON.stringify({ failures, maximum: Math.max(...files.flatMap(file => file.methods.map(method => method.score))) }, null, 2))
  if (failures.length > 0) process.exitCode = 1
}
