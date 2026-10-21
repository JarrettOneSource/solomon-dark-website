declare const __SDR_BUILD_REVISION__: string

export const WEBSITE_BUILD_REVISION = typeof __SDR_BUILD_REVISION__ === 'string' ? __SDR_BUILD_REVISION__ : null

const FULL_GIT_REVISION = /^[0-9a-f]{40}$/

export async function deploymentRevisionFromResponse(
  response: Response,
): Promise<string | null> {
  if (!response.ok) return null
  try {
    const value = await response.json() as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const revision = (value as Record<string, unknown>).revision
    if (typeof revision !== 'string') return null
    const normalized = revision.trim().toLowerCase()
    return FULL_GIT_REVISION.test(normalized) ? normalized : null
  } catch {
    return null
  }
}

/** Shared by initial module recovery and the already-mounted game watcher. */
export function reloadForDeploymentRevision(revision: string): boolean {
  try {
    const key = 'sdr.deployment-reload-revision'
    if (sessionStorage.getItem(key) === revision) return false
    // Claim before navigating, including when stale HTML loads successfully.
    sessionStorage.setItem(key, revision)
  } catch {
    // Without storage we cannot guarantee a loop-free automatic reload.
    return false
  }
  window.location.reload()
  return true
}

