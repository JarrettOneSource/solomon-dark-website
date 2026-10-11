import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import electron from 'electron'

if (process.platform === 'win32') await run('cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'])
else await run('npm', ['run', 'build'])
await mkdir('../backend/wwwroot/__desktop', { recursive: true })
await Promise.all(['launcher.html', 'launcher.css', 'launcher.mjs'].map(file => cp(`desktop/${file}`, `../backend/wwwroot/__desktop/${file}`)))
const child = spawn(electron, [resolve('desktop')], {
  env: {
    ...process.env,
    SDR_DESKTOP_BUILD_JSON: JSON.stringify({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceTimestamp: 0 }),
    SDR_DESKTOP_CLIENT_ROOT: resolve('../backend/wwwroot'),
    SDR_DESKTOP_GAME_HOST: resolve('dist-game-host/game-host.mjs'),
    SDR_DESKTOP_NODE: process.execPath,
  },
  stdio: 'inherit',
})
process.once('SIGINT', () => child.kill('SIGTERM'))
process.once('SIGTERM', () => child.kill('SIGTERM'))
const exit = await new Promise((resolveExit, reject) => {
  child.once('error', reject)
  child.once('exit', (code, signal) => resolveExit({ code, signal }))
})
process.exitCode = exit.code ?? (exit.signal ? 1 : 0)

function run(command, arguments_) {
  return new Promise((resolveRun, reject) => {
    const process = spawn(command, arguments_, { stdio: 'inherit' })
    process.once('error', reject)
    process.once('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else reject(new Error(`${command} failed (${code ?? signal ?? 'unknown'})`))
    })
  })
}
