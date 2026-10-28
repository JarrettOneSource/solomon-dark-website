import { useEffect } from 'react'
import { Spinner } from '../components/ui.tsx'
import { gameArtifactUrl } from '../lib/game-artifact.ts'

/** The separately published Rust document owns the renderer and its lifecycle. */
export default function Game() {
  useEffect(() => {
    window.location.replace(`${gameArtifactUrl()}${window.location.search}${window.location.hash}`)
  }, [])
  return <Spinner label="Opening Solomon Dark…" />
}
