import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const FULL_GIT_REVISION = /^[0-9a-f]{40}$/

export async function readDeployedRevision(releaseRoot = process.cwd()): Promise<string> {
  const revision = (await readFile(resolve(releaseRoot, 'DEPLOYED_GIT_SHA'), 'utf8'))
    .trim()
    .toLowerCase()
  if (!FULL_GIT_REVISION.test(revision)) {
    throw new Error('DEPLOYED_GIT_SHA must contain a full Git commit ID')
  }
  return revision
}
