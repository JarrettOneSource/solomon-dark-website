import { spawn } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import { packager } from '@electron/packager'

import { stagePinnedNodeRuntime } from './stage-node-runtime.mjs'

const platform = argument('--platform')
const arch = argument('--arch')
if (platform !== 'linux' || !['x64', 'arm64'].includes(arch)) {
  throw new Error('Current desktop packaging supports linux x64 and arm64')
}
const [frontendPackage, desktopPackage] = await Promise.all([
  readJson(resolve('package.json')),
  readJson(resolve('desktop/package.json')),
])
const electronVersion = frontendPackage.devDependencies.electron
const stage = resolve('.desktop-stage', `${platform}-${arch}`)
const output = resolve('dist-desktop')
await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'])
await rm(stage, { force: true, recursive: true })
await mkdir(stage, { recursive: true })
await Promise.all([
  cp(resolve('desktop/main.mjs'), join(stage, 'main.mjs')),
  cp(resolve('desktop/preload.cjs'), join(stage, 'preload.cjs')),
  cp(resolve('desktop/static-client-server.mjs'), join(stage, 'static-client-server.mjs')),
  cp(resolve('desktop/package.json'), join(stage, 'package.json')),
  cp(resolve('../backend/wwwroot'), join(stage, 'client'), { recursive: true }),
  cp(resolve('dist-game-host'), join(stage, 'game-host'), { recursive: true }),
])
const runtime = await stagePinnedNodeRuntime({
  platform,
  arch,
  destination: join(stage, 'runtime'),
})
const applicationPaths = await packager({
  appVersion: desktopPackage.version,
  arch,
  asar: false,
  dir: stage,
  electronVersion,
  executableName: 'solomon-dark',
  name: 'Solomon Dark',
  out: output,
  overwrite: true,
  platform,
  prune: false,
})
if (applicationPaths.length !== 1) throw new Error('Desktop packager produced an unexpected output set')
const applicationPath = applicationPaths[0]
const executable = join(applicationPath, 'solomon-dark')
const manifest = {
  arch,
  electronVersion,
  executable: basename(executable),
  nodeRuntime: {
    sha256: runtime.sha256,
    version: runtime.version,
  },
  platform,
}
await writeFile(
  join(applicationPath, 'desktop-package-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
process.stdout.write(`${JSON.stringify({ ...manifest, applicationPath, executable })}\n`)

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function argument(name) {
  const index = process.argv.indexOf(name)
  const value = index < 0 ? undefined : process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

function run(command, arguments_) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, arguments_, { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else reject(new Error(`${basename(command)} failed (${code ?? signal ?? 'unknown'})`))
    })
  })
}
