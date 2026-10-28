import { spawnSync } from 'node:child_process'
import { mkdir, rm, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { readGameArtifact, remountGameArtifact, stageGameArtifact } from './game-artifact.mjs'

const frontend = fileURLToPath(new URL('..', import.meta.url))
function run(script, args = [], environment = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: frontend, env: { ...process.env, ...environment }, stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${script} failed (${result.signal || result.status})`)
}

const artifact = await readGameArtifact({
  dist: process.env.SDR_GAME_DIST, nativeHost: process.env.SDR_GAME_NATIVE_HOST,
})
run('node_modules/typescript/bin/tsc', ['-b'])
run('node_modules/vite/bin/vite.js', ['build'], {
  VITE_GAME_RUNTIME: 'pixi', VITE_WEBSITE_BASE: '', VITE_GAME_ARTIFACT_BASE: '/game-rust',
  SDR_WEBSITE_ASSET_BASE: '/', SDR_WEBSITE_OUT_DIR: '../backend/wwwroot',
})
run('tools/build-game-host.mjs')
run('tools/check-game-bundle-budget.mjs')
run('node_modules/vite/bin/vite.js', ['build'], {
  VITE_GAME_RUNTIME: 'rust', VITE_WEBSITE_BASE: '/game-rust', VITE_GAME_ARTIFACT_BASE: '/game-rust',
  SDR_WEBSITE_ASSET_BASE: '/game-rust/site/', SDR_WEBSITE_OUT_DIR: 'dist-rust-site',
})

const generated = join(frontend, '.cache/companion-game')
await rm(generated, { recursive: true, force: true })
await mkdir(join(frontend, '.cache'), { recursive: true })
const mounted = await remountGameArtifact(artifact, generated, '/game-rust')
await stageGameArtifact(mounted, join(frontend, '../backend/wwwroot/game-rust'))
await mkdir(join(frontend, 'reports'), { recursive: true })
for (const name of ['game-artifact.json', 'game-source-artifact.json'])
  await copyFile(join(generated, name), join(frontend, 'reports', name))
await rm(generated, { recursive: true, force: true })
console.log(`Built PixiJS at /game and Rust ${artifact.manifest.revision} at /game-rust.`)
