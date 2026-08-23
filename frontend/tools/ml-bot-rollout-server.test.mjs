import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import readline from 'node:readline'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SERVER = new URL('./ml-bot-rollout-server.mjs', import.meta.url)

test('rollout server carries exact plans, expert transitions, and selective resets', async () => {
  const bridge = new TestRolloutBridge()
  try {
    const initialized = await bridge.request({
      seeds: [101, 102],
      type: 'initialize',
      workerCount: 2,
    })
    assert.equal(initialized.ok, true)
    assert.equal(initialized.protocol, 'solomon-dark-ml-rollout-v5')
    assert.equal(initialized.worldCount, 2)
    assert.equal(bytes(initialized.observations), 2 * 1_784 * 4)
    assert.equal(bytes(initialized.plans.movement), 2 * 9)
    assert.equal(bytes(initialized.plans.target), 2 * 9)
    assert.equal(bytes(initialized.plans.abilityByTarget), 2 * 9 * 22)
    assert.equal(bytes(initialized.plans.aimByAbility), 2 * 22 * 9)

    const expert = await bridge.request({ ticks: 2, type: 'expert-step' })
    assert.equal(expert.ok, true)
    assert.equal(bytes(expert.transition.actions), 2 * 4)
    assert.equal(bytes(expert.transition.observations), 2 * 1_784 * 4)
    assert.equal(bytes(expert.transition.rewards), 2 * 8)
    assert.equal(bytes(expert.transition.ticks), 2 * 4)
    assert.notDeepEqual(expert.hashes, initialized.hashes)

    const reset = await bridge.request({ seeds: [101, null], type: 'reset' })
    assert.equal(reset.hashes[0], initialized.hashes[0])
    assert.equal(reset.hashes[1], expert.hashes[1])

    const rejected = await bridge.request({ actions: '', type: 'step' })
    assert.equal(rejected.ok, false)
    assert.match(rejected.error, /byte length/)
  } finally {
    await bridge.close()
  }
})

class TestRolloutBridge {
  #nextId = 1
  #pending = new Map()
  #process = spawn(process.execPath, [
    '--experimental-strip-types',
    fileURLToPath(SERVER),
  ], { stdio: ['pipe', 'pipe', 'inherit'] })

  constructor() {
    const lines = readline.createInterface({ input: this.#process.stdout, crlfDelay: Infinity })
    lines.on('line', (line) => {
      const response = JSON.parse(line)
      const pending = this.#pending.get(response.id)
      if (!pending) return
      this.#pending.delete(response.id)
      pending.resolve(response)
    })
    this.#process.once('error', error => this.#rejectAll(error))
    this.#process.once('exit', (code) => {
      if (code !== 0) this.#rejectAll(new Error(`rollout server exited with code ${code}`))
    })
  }

  request(message) {
    const id = this.#nextId
    this.#nextId += 1
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { reject, resolve })
      this.#process.stdin.write(`${JSON.stringify({ ...message, id })}\n`)
    })
  }

  async close() {
    if (this.#process.exitCode !== null) return
    await this.request({ type: 'close' })
    await new Promise(resolve => this.#process.once('exit', resolve))
  }

  #rejectAll(error) {
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
  }
}

function bytes(value) {
  assert.equal(typeof value, 'string')
  return Buffer.from(value, 'base64').length
}
