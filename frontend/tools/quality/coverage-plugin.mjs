import { resolve } from 'node:path'
import { rendererFiles } from './scope.mjs'
import { instrumentRenderer } from './instrument.mjs'

export function rendererCoveragePlugin() {
  const targets = new Set(rendererFiles.map(file => resolve(file)))
  return {
    name: 'renderer-quality-coverage',
    enforce: 'pre',
    transform(source, id) {
      if (!targets.has(id)) return null
      const { code, map } = instrumentRenderer(source, id)
      return { code, map }
    },
  }
}
