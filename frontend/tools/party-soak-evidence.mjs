import { writeFileSync } from 'node:fs'
import { open, rename } from 'node:fs/promises'
import { join } from 'node:path'

// The native host rethrows fatal tick errors immediately after archiveRun.
// Finish these infrequent terminal writes before returning to that caller.
export function writeSoakEvidence(output, name, value) {
  writeFileSync(join(output, name), JSON.stringify(value, (_key, entry) => (
    entry instanceof Map ? Object.fromEntries(entry) : entry
  )), { flag: 'wx', mode: 0o600 })
}

export async function writeDiagnosticCheckpoint(path, json) {
  const temporary = `${path}.writing`
  const file = await open(temporary, 'w', 0o600)
  try {
    await file.chmod(0o600)
    await file.writeFile(json)
  } finally { await file.close() }
  await rename(temporary, path)
}

export function createDiagnosticCheckpointWriter(path, onError, write = writeDiagnosticCheckpoint) {
  let pending = null
  let running = null
  let firstError = null
  const status = { file: path, savedSequence: null, writes: 0, coalesced: 0, failures: 0 }
  const start = () => {
    if (running || !pending) return
    running = Promise.resolve().then(async () => {
      while (pending) {
        const checkpoint = pending
        pending = null
        try {
          await write(path, JSON.stringify(checkpoint))
          status.savedSequence = checkpoint.checkpointSequence
          status.writes += 1
        } catch (error) {
          firstError ??= error
          status.failures += 1
          onError(error)
        }
      }
    }).finally(() => { running = null; start() })
  }
  return {
    push(checkpointSequence, save) {
      if (pending) status.coalesced += 1
      pending = {
        purpose: 'Diagnostic latest owner save; rejoin credential removed',
        checkpointSequence, receivedAtUtc: new Date().toISOString(),
        redactedFields: ['continuation.summary.partyRejoinToken'],
        save: { ...save, continuation: save.continuation === null ? null : {
          ...save.continuation, summary: { ...save.continuation.summary, partyRejoinToken: null },
        } },
      }
      start()
    },
    async flush() {
      while (running || pending) { start(); await running }
      if (firstError) throw firstError
    },
    status() { return { ...status } },
  }
}
