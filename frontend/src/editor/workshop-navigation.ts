import type { LoaderFunctionArgs } from 'react-router-dom'

import { docFileValue, importDocValue } from './io.ts'
import type { WorkshopRequest } from './store.ts'
import { gameArtifactUrl } from '../lib/game-artifact.ts'
import { websiteUrl } from '../lib/website-mount.ts'
import { consumeWorkshopRequest, putWorkshopRequest } from './workshop-request-store.ts'

/** The iframe and editor share a tab's same-origin session storage, not game state. */
export async function storeWorkshopRequest(request: WorkshopRequest): Promise<string> {
  const stored = request.kind === 'new' ? request : {
    kind: request.kind,
    document: docFileValue(request.doc),
    draftId: request.draftId,
    savedAt: request.savedAt,
    test: request.test,
  }
  const id = await putWorkshopRequest(stored)
  return `${websiteUrl('/boneyard')}?workshop=${encodeURIComponent(id)}`
}

/** A route loader consumes once before StrictMode mounts the editor twice. */
export async function takeWorkshopRequest(id: string): Promise<WorkshopRequest> {
  return decodeWorkshopRequest(await consumeWorkshopRequest(id))
}

export function decodeWorkshopRequest(value: unknown): WorkshopRequest {
  if (typeof value !== 'object' || value === null || !('kind' in value)) {
    throw new Error('The workshop request could not be read.')
  }
  if (value.kind === 'new') return { kind: 'new' }
  if (value.kind !== 'open'
    || !('draftId' in value) || typeof value.draftId !== 'string'
    || !('savedAt' in value) || typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)
    || !('test' in value) || typeof value.test !== 'boolean'
    || !('document' in value)) {
    throw new Error('The workshop request could not be read.')
  }
  return {
    kind: 'open',
    doc: importDocValue(value.document),
    draftId: value.draftId,
    savedAt: value.savedAt,
    test: value.test,
  }
}

/** Return targets are deployment-owned; stored requests cannot supply redirects. */
export function boneyardLibraryReturnUrl(): string {
  return gameArtifactUrl('?dark-cloud=boneyards')
}

export async function loadWorkshopRequest({ request }: LoaderFunctionArgs) {
  const id = new URL(request.url).searchParams.get('workshop')
  if (id === null) return { request: null, error: null }
  try {
    return { request: await takeWorkshopRequest(id), error: null }
  } catch (reason) {
    return { request: null, error: reason instanceof Error ? reason.message : 'The workshop request could not be read.' }
  }
}
