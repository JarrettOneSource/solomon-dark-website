import { ApiError, type api } from '../lib/api.ts'

// ---------- local draft -> Annals (cloud) mapping ----------

const CLOUD_MAP_KEY = 'sdr:boneyard:cloudmap'
let unsavedCloudMap: Record<string, number> | null = null

function cloudMap(): Record<string, number> {
  if (unsavedCloudMap) return unsavedCloudMap
  try {
    return JSON.parse(localStorage.getItem(CLOUD_MAP_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function cloudIdFor(draftId: string): number | null {
  return cloudMap()[draftId] ?? null
}

export function setCloudId(draftId: string, cloudId: number | null) {
  const map = cloudMap()
  if (cloudId === null) delete map[draftId]
  else map[draftId] = cloudId
  try {
    localStorage.setItem(CLOUD_MAP_KEY, JSON.stringify(map))
    unsavedCloudMap = null
  } catch {
    // A full browser must not prevent saving the document to its cloud draft.
    unsavedCloudMap = map
  }
}

type CloudDrafts = Pick<typeof api.boneyards, 'create' | 'update'>

/**
 * Writes a local draft to its cloud copy and returns the copy's id. A copy that is gone, deleted
 * here or on another device or owned by another account, is replaced by a new one.
 */
export async function saveDraftToCloud(
  drafts: CloudDrafts,
  draftId: string,
  name: string,
  patch: Parameters<CloudDrafts['update']>[1],
): Promise<number> {
  const cloudId = cloudIdFor(draftId)
  if (cloudId !== null) {
    try {
      await drafts.update(cloudId, patch)
      return cloudId
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }
  }
  const created = await drafts.create(name)
  // Remember the copy before writing it, so a failed write is retried into it instead of duplicated.
  setCloudId(draftId, created.id)
  await drafts.update(created.id, patch)
  return created.id
}
