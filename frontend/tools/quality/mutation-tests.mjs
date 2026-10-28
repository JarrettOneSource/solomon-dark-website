import { spawnSync } from 'node:child_process'
import { rendererTests } from './scope.mjs'

for (const args of [
  ['--experimental-strip-types', '--test', ...rendererTests],
  ['tools/smoke-native-render-materials.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1
    break
  }
}
