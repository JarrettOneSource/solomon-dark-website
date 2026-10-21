/** Website routes, API and account storage share this deployment prefix. */
export const websiteBase = (import.meta.env?.VITE_WEBSITE_BASE || '').replace(/\/$/, '')

export function websiteUrl(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') ? `${websiteBase}${path}` : path
}

export function websiteStorageKey(key: string): string {
  return websiteBase ? `${key}:${websiteBase}` : key
}
