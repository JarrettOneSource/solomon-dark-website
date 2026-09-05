import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rendererFiles } from './scope.mjs'
import { instrumentRenderer } from './instrument.mjs'

const targets = new Set(rendererFiles.map(file => resolve(file)))
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:')) {
      const file = fileURLToPath(url)
      if (targets.has(file)) {
        const { code } = instrumentRenderer(readFileSync(file, 'utf8'), file)
        return { format: 'module', source: code, shortCircuit: true }
      }
    }
    return nextLoad(url, context)
  },
})

process.once('exit', () => {
  const coverage = globalThis.__coverage__
  if (!coverage) return
  const directory = resolve('reports/renderer-quality/coverage/raw')
  mkdirSync(directory, { recursive: true })
  writeFileSync(`${directory}/node-${process.pid}.json`, JSON.stringify(coverage))
})
