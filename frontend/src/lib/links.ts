// External destinations referenced across the site.

/** The mod loader's GitHub repository. */
export const MOD_LOADER_REPO_URL = 'https://github.com/JarrettOneSource/solomons-dark-modding'

/** Where the loader downloads live. */
export const MOD_LOADER_DOWNLOAD_URL = `${MOD_LOADER_REPO_URL}/releases`

/**
 * Protocol link that hands a mod to the installed launcher, which downloads,
 * verifies, and installs it. Shape mirrors the launcher's strict join-URI
 * contract: verb as host, a single path segment, `directory` = this origin.
 */
export function launcherInstallUri(slug: string): string {
  return `solomondarkrevived://install-mod/${encodeURIComponent(slug)}?directory=${encodeURIComponent(window.location.origin)}`
}
