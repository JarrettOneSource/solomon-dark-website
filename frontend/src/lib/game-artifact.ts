/** The separately built Rust distribution, mounted by the Website deployment. */
const gameArtifactBase = (import.meta.env?.VITE_GAME_ARTIFACT_BASE || '/game').replace(/\/$/, '')

export function gameArtifactUrl(path = ''): string {
  return `${gameArtifactBase}/${path}`
}
