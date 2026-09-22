import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createGameSimulation } from '../src/game/core-server/game-simulation.ts'
import { createHubSkorcha } from '../src/game/core-server/hub-skorcha.ts'
import { createHubStudentFixturePopulation } from '../src/game/core-server/hub-student-fixtures.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

// Use the production build, real host, real fixed ticks and ordinary UI journey.
// Control the seed/windows and omit Students to keep the head crop unoccluded.
const seeds = new Map()
for (let seed = 0; seed < 10_000 && seeds.size < 4; seed += 1) {
  const variant = createHubSkorcha(seed)?.variant ?? 'absent'
  if (!seeds.has(variant)) seeds.set(variant, seed)
}
assert.equal(seeds.size, 4)
const staticServer = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
try {
  const scenarios = [
    ...[0, 1, 2].map(variant => ({ section: 'skorcha', variant })),
    { section: 'skorcha-timer-appear', variant: 'absent' },
    { section: 'skorcha-timer-disappear', variant: 2 },
  ]
  for (const { section, variant } of scenarios) {
    const seed = seeds.get(variant)
    const credential = `skorcha-proof-${section}-${variant}`
    const gameHost = await startGameHost({
      allowedOrigins: [staticServer.origin],
      authentication: { kind: 'shared', credential },
      createSimulation: () => createGameSimulation({}, {
        hubTraderAnimationSeed: seed,
        hubStudentPopulation: createHubStudentFixturePopulation({ count: 0, seed }),
        hubSkorchaHiddenTicks: 1_500,
        hubSkorchaVisibleTicks: section === 'skorcha-timer-disappear' ? 6_000 : 60_000,
      }),
      resetWhenEmpty: true,
      snapshotRate: 20,
    })
    try {
      process.stdout.write(`${JSON.stringify({ section, seed, variant })}\n`)
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [
          '--experimental-strip-types',
          fileURLToPath(new URL('./smoke-hub-npcs.mjs', import.meta.url)),
        ], {
          env: {
            ...process.env,
            SDR_GAME_ENDPOINT_URL: gameHost.address.url,
            SDR_GAME_ENDPOINT_CREDENTIAL: credential,
            SDR_GAME_ENDPOINT_SESSION_KIND: 'standalone',
            SDR_GAME_NPC_SMOKE_URL: staticServer.origin,
            SDR_GAME_NPC_SMOKE_ONLY: section,
            SDR_GAME_NPC_VERIFY_SKORCHA_ANIMATION: section === 'skorcha' ? '1' : '0',
            ...(variant === 'absent' ? {} : { SDR_GAME_NPC_EXPECT_SKORCHA_VARIANT: `${variant}` }),
            SDR_GAME_NPC_SCREENSHOT_ROOT: join(tmpdir(), `skorcha-${section}-${variant}`),
          },
          stdio: 'inherit',
        })
        child.once('error', reject)
        child.once('exit', code => code === 0
          ? resolve()
          : reject(new Error(`Skorcha ${section}/${variant} exited ${code}`)))
      })
    } finally {
      await gameHost.close()
    }
  }
} finally {
  await staticServer.close()
}
