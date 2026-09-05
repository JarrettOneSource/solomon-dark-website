import { stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'
import { createInstrumenter } from 'istanbul-lib-instrument'

export function instrumentRenderer(source, file) {
  // Strip mode preserves positions, so the counters describe authored TS
  // statements rather than transpiler helpers or generated Vite wrappers.
  const stripped = stripTypeScriptTypes(source, { mode: 'strip' })
  const instrumenter = createInstrumenter({
    esModules: true,
    coverageGlobalScope: 'globalThis',
    coverageGlobalScopeFunc: false,
    compact: false,
    produceSourceMap: true,
  })
  const code = instrumenter.instrumentSync(stripped, resolve(file))
  return { code, coverage: instrumenter.lastFileCoverage(), map: instrumenter.lastSourceMap() }
}
