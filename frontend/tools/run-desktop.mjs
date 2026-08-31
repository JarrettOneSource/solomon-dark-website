import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

import electron from 'electron'

await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'])
const child = spawn(electron, [resolve('desktop')], {
  env: {
    ...process.env,
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
