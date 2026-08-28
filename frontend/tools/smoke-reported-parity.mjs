import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_REPORTED_PARITY_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-reported-parity'
await mkdir(screenshotRoot, { recursive: true })
await mkdir(`${screenshotRoot}/game-over`, { recursive: true })

const steps = [
  {
    args: ['tools/smoke-sacks-dyes.mjs'],
    env: {
      SDR_SACKS_DYES_REPORTED_PARITY_ONLY: '1',
      SDR_SACKS_DYES_SCREENSHOT_ROOT: `${screenshotRoot}/inventory`,
    },
    name: 'stats pages and charm removal',
  },
  {
    args: ['tools/smoke-secondary-abilities.mjs'],
    env: {
      SDR_SECONDARY_ABILITY_ID: '35',
      SDR_SECONDARY_ABILITY_PRODUCTION: '1',
      SDR_SECONDARY_ABILITY_SCENE: 'boneyard',
      SDR_SECONDARY_ABILITY_SCREENSHOT_ROOT: `${screenshotRoot}/secondary`,
      SDR_SECONDARY_PRIMARY_OVERLAP: '1',
    },
    name: 'secondary admission while primary is held',
  },
  {
    args: ['tools/smoke-loot-drops.mjs'],
    env: {
      SDR_LOOT_BUILT: '1',
      SDR_LOOT_SCREENSHOT_ROOT: `${screenshotRoot}/loot`,
    },
    name: 'wave-four Gold Charm amount and tier-three presentation',
  },
  {
    args: ['tools/smoke-multiplayer-combat-lifecycle.mjs', '--death-game-over-only'],
    env: {
      SDR_GAME_MULTIPLAYER_COMBAT_PRODUCTION: '1',
      SDR_GAME_MULTIPLAYER_COMBAT_SCREENSHOT_ROOT: `${screenshotRoot}/game-over`,
    },
    name: 'completed-run Luthacus bottle archival',
  },
]

for (const step of steps) {
  process.stdout.write(`[reported-parity] ${step.name}\n`)
  await run(step.args, step.env)
}

process.stdout.write(`${JSON.stringify({
  screenshotRoot,
  status: 'ok',
  steps: steps.map(({ name }) => name),
})}\n`)

function run(args, extraEnvironment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', ...args], {
      cwd: frontendRoot,
      env: { ...process.env, ...extraEnvironment },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(
        `${args[0]} failed with ${signal === null ? `exit ${code}` : `signal ${signal}`}`,
      ))
    })
  })
}
