export const DESKTOP_RELEASES_URL = 'https://github.com/JarrettOneSource/solomon-dark-website/releases'
const RELEASE_API = 'https://api.github.com/repos/JarrettOneSource/solomon-dark-website/releases/latest'
const PLATFORMS = [
  { name: 'Solomon-Darker-Setup-x64.exe', label: 'Windows 64-bit', detail: 'Installer for Windows PCs' },
  { name: 'Solomon-Darker-arm64.dmg', label: 'macOS · Apple Silicon', detail: 'For Macs with M-series chips' },
  { name: 'Solomon-Darker-x64.AppImage', label: 'Linux 64-bit', detail: 'Portable AppImage' },
] as const

export interface DesktopRelease {
  version: string
  assets: { label: string; detail: string; url: string }[]
}

export function parseDesktopRelease(value: unknown): DesktopRelease {
  if (!value || typeof value !== 'object') throw new Error('Invalid release catalog')
  const release = value as Record<string, unknown>
  if (typeof release.tag_name !== 'string' || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)
    || release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets)) {
    throw new Error('No supported public desktop release is available')
  }
  const assets = PLATFORMS.flatMap(platform => {
    const exists = release.assets instanceof Array && release.assets.some(asset => asset && typeof asset === 'object'
      && asset.name === platform.name && asset.state === 'uploaded' && typeof asset.size === 'number' && asset.size > 0)
    return exists ? [{ label: platform.label, detail: platform.detail,
      url: `${DESKTOP_RELEASES_URL}/download/${release.tag_name}/${platform.name}` }] : []
  })
  if (!assets.length) throw new Error('No desktop installers have been published yet')
  return { version: release.tag_name.slice(1), assets }
}

export async function loadDesktopRelease(signal: AbortSignal): Promise<DesktopRelease | null> {
  const response = await fetch(RELEASE_API, { signal, credentials: 'omit', headers: { accept: 'application/vnd.github+json' } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('The download catalog is temporarily unavailable. Check the releases page below.')
  return parseDesktopRelease(await response.json())
}
