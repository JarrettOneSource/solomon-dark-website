import { spawnSync } from 'node:child_process'
import { rendererFiles } from './scope.mjs'

const result = spawnSync('node_modules/.bin/jscpd', ['--config', 'jscpd.renderer.json', ...rendererFiles], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
