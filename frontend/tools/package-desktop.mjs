import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { packager } from '@electron/packager'
import { stagePinnedNodeRuntime } from './stage-node-runtime.mjs'

const platform = argument('--platform')
const arch = argument('--arch')
if (!['linux-x64', 'darwin-x64', 'darwin-arm64', 'win32-x64'].includes(`${platform}-${arch}`)) {
  throw new Error('Supported desktop targets: Windows x64, macOS x64/arm64 and Linux x64.')
}
const [frontendPackage, desktopPackage] = await Promise.all([
  readJson(resolve('package.json')),
  readJson(resolve('desktop/package.json')),
])
const build = {
  schemaVersion: 1,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceTimestamp: Number(execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], { encoding: 'utf8' }).trim()),
}
const electronVersion = frontendPackage.devDependencies.electron
const stage = resolve('.desktop-stage', `${platform}-${arch}`)
const output = resolve('dist-desktop')
if (!process.argv.includes('--skip-build')) {
  if (process.platform === 'win32') await run('cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'])
  else await run('npm', ['run', 'build'])
}
await rm(stage, { force: true, recursive: true })
await mkdir(join(stage, 'client', '__desktop'), { recursive: true })
await Promise.all([
  ...['main.mjs', 'preload.cjs', 'static-client-server.mjs', 'local-game-host.mjs', 'runtime-service.mjs', 'local-peer.mjs', 'run-peer-service.mjs', 'peer-network.mjs', 'updates.mjs', 'package.json'].map(file => cp(resolve('desktop', file), join(stage, file))),
  cp(resolve('../backend/wwwroot'), join(stage, 'client'), { recursive: true }),
  cp(resolve('dist-game-host'), join(stage, 'game-host'), { recursive: true }),
  writeFile(join(stage, 'desktop-build.json'), `${JSON.stringify(build, null, 2)}\n`),
])
await Promise.all(['launcher.html', 'launcher.css', 'launcher.mjs'].map(file => cp(resolve('desktop', file), join(stage, 'client', '__desktop', file))))
const runtime = await stagePinnedNodeRuntime({ platform, arch, destination: join(stage, 'runtime') })
const applicationPaths = await packager({
  appVersion: desktopPackage.version,
  appBundleId: 'com.jarrett.solomondarker',
  arch,
  asar: false,
  dir: stage,
  electronVersion,
  executableName: 'solomon-darker',
  name: 'Solomon Darker',
  out: output,
  overwrite: true,
  platform,
  ...(platform === 'darwin' ? { osxSign: {
    identity: '-', identityValidation: false, preAutoEntitlements: false, preEmbedProvisioningProfile: false,
    optionsForFile: () => ({ hardenedRuntime: false, timestamp: 'none' }),
  } } : {}),
  prune: false,
})
if (applicationPaths.length !== 1) throw new Error('Desktop packager produced an unexpected output set')
const applicationPath = applicationPaths[0]
const executable = platform === 'darwin'
  ? 'Solomon Darker.app/Contents/MacOS/solomon-darker'
  : platform === 'win32' ? 'solomon-darker.exe' : 'solomon-darker'
const manifest = {
  ...build, arch, electronVersion, executable, platform,
  nodeRuntime: { sha256: runtime.sha256, version: runtime.version },
}
await writeFile(join(applicationPath, 'desktop-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await writeFile(join(output, 'desktop-release.json'), `${JSON.stringify(build, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ ...manifest, applicationPath })}\n`)

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')) }

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
