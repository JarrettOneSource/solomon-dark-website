import { spawn } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import { Arch, build, Platform } from 'electron-builder'

import { stagePinnedNodeRuntime } from './stage-node-runtime.mjs'
import { desktopBuildConfig } from './desktop-build-config.mjs'

const platform = argument('--platform', process.platform)
const arch = argument('--arch', process.arch)
const target = { 'win32-x64': Platform.WINDOWS, 'darwin-arm64': Platform.MAC, 'linux-x64': Platform.LINUX }[`${platform}-${arch}`]
if (!target) throw new Error(`Unsupported desktop target: ${platform}-${arch}`)
const publishing = process.argv.includes('--publish')
const release = publishing || process.argv.includes('--release')
const directoryOnly = process.argv.includes('--dir')
if (release && directoryOnly) throw new Error('An unpacked directory is not a release')
const [frontendPackage, desktopPackage] = await Promise.all([
  readJson(resolve('package.json')),
  readJson(resolve('desktop/package.json')),
])
const electronVersion = frontendPackage.devDependencies.electron
const stage = resolve('.desktop-stage', `${platform}-${arch}`)
const output = resolve('dist-desktop')
const config = desktopBuildConfig({ stage, electronVersion, platform, release })
if (release && process.env.GITHUB_REF_NAME !== `v${desktopPackage.version}`) {
  throw new Error(`Release tag must exactly match v${desktopPackage.version}`)
}
await runNpm(['ci', '--prefix', 'desktop', '--no-audit', '--no-fund'])
if (!process.argv.includes('--skip-build')) await runNpm(['run', 'build'])
await rm(stage, { force: true, recursive: true })
await mkdir(stage, { recursive: true })
await Promise.all([
  cp(resolve('../backend/wwwroot'), join(stage, 'client'), { recursive: true }),
  cp(resolve('dist-game-host'), join(stage, 'game-host'), { recursive: true }),
])
const runtime = await stagePinnedNodeRuntime({
  platform,
  arch,
  destination: join(stage, 'runtime'),
})
const manifest = {
  arch,
  electronVersion,
  executable: platform === 'win32' ? 'Solomon Darker.exe'
    : platform === 'darwin' ? 'Solomon Darker.app/Contents/MacOS/Solomon Darker' : 'solomon-darker',
  nodeRuntime: {
    sha256: runtime.sha256,
    version: runtime.version,
  },
  platform,
  version: desktopPackage.version,
}
await writeFile(
  join(stage, 'desktop-package-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
const artifacts = await build({
  targets: target.createTarget(directoryOnly ? 'dir' : undefined, Arch[arch]),
  publish: publishing ? 'always' : 'never',
  config,
})
process.stdout.write(`${JSON.stringify({ ...manifest, artifacts, output })}\n`)

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const value = index < 0 ? undefined : process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

function runNpm(arguments_) {
  return new Promise((resolveRun, reject) => {
    const npm = process.env.npm_execpath
    const command = npm ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
    const args = npm ? [npm, ...arguments_] : arguments_
    const child = spawn(command, args, { stdio: 'inherit', shell: !npm && process.platform === 'win32' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else reject(new Error(`${basename(command)} failed (${code ?? signal ?? 'unknown'})`))
    })
  })
}
