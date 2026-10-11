const REPOSITORY = 'https://github.com/JarrettOneSource/solomon-dark-website'
const LATEST_RELEASE = 'https://api.github.com/repos/JarrettOneSource/solomon-dark-website/releases/latest'

export async function checkForDesktopUpdate({ build, platform, arch, request = fetch }) {
  const options = { signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' }, cache: 'no-store' }
  const response = await request(LATEST_RELEASE, options)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Update check failed (HTTP ${response.status}).`)
  const release = await response.json()
  const revision = /^desktop-([a-f\d]{40})$/.exec(release?.tag_name)?.[1]
  if (!revision || release.draft !== false || release.prerelease !== false
    || revision === build.revision || !Array.isArray(release.assets)) return null
  const base = `${REPOSITORY}/releases/download/desktop-${revision}`
  const manifestUrl = `${base}/desktop-release.json`
  const filename = `Solomon-Darker-${platform}-${arch}.zip`
  const url = `${base}/${filename}`
  if (!release.assets.some(asset => asset.name === 'desktop-release.json' && asset.browser_download_url === manifestUrl)
    || !release.assets.some(asset => asset.name === filename && asset.browser_download_url === url)) return null
  const manifestResponse = await request(manifestUrl, options)
  if (!manifestResponse.ok) throw new Error(`Update manifest failed (HTTP ${manifestResponse.status}).`)
  const manifest = await manifestResponse.json()
  if (manifest?.schemaVersion !== 1 || manifest.revision !== revision
    || !Number.isSafeInteger(manifest.sourceTimestamp)
    || manifest.sourceTimestamp <= build.sourceTimestamp) return null
  return { revision, url }
}
