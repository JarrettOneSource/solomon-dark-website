import { useEffect, useRef, useState } from 'react'
import { gameArtifactUrl } from '../lib/game-artifact.ts'
import { bytesToBase64, compileNative } from './io.ts'
import type { EditorDoc } from './model.ts'

interface EditorTestRuntimeProps {
  accountUsername: string | null
  doc: EditorDoc
  onReturn: () => void
}

/** The draft stays mounted while one disposable Rust document owns the test. */
export default function EditorTestRuntime({ accountUsername, doc, onReturn }: EditorTestRuntimeProps) {
  const [playing, setPlaying] = useState(false)
  const [stage, setStage] = useState('Preparing your Boneyard')
  const [error, setError] = useState<string | null>(null)
  const returnButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    let ready = false
    let started = false
    let disposed = false
    let payload: { name: string, bytesBase64: string, accountUsername: string | null } | null = null
    const frame = document.createElement('iframe')
    frame.src = gameArtifactUrl('editor-test/')
    frame.title = 'Private Boneyard test'
    frame.className = 'editor-test-frame'
    frame.allow = 'autoplay; fullscreen'
    const origin = new URL(frame.src).origin
    const dispose = () => {
      disposed = true
      window.removeEventListener('message', receive)
      frame.remove()
    }
    const start = () => {
      if (cancelled || started || !ready || !payload) return
      started = true
      setStage('Loading the test world')
      frame.contentWindow?.postMessage({ type: 'solomon-editor-test-start', ...payload }, origin)
    }
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== origin || event.source !== frame.contentWindow) return
      const message = event.data
      if (typeof message !== 'object' || message === null || !('type' in message)) return
      switch (message.type) {
        case 'solomon-editor-test-ready':
          ready = true
          start()
          break
        case 'solomon-editor-test-disposed':
          dispose()
          break
        case 'solomon-editor-test-return':
          if (!cancelled) onReturn()
          break
        case 'solomon-editor-test-state':
          if (cancelled || !('state' in message)) return
          if (message.state === 'playing') {
            setPlaying(true)
          } else if ('message' in message && typeof message.message === 'string') {
            if (message.state === 'error') {
              setPlaying(false)
              setError(message.message)
            } else if (message.state === 'loading') {
              setStage(message.message)
            }
          }
      }
    }
    window.addEventListener('message', receive)
    // Moving an iframe between DOM parents reloads its document. Keep its one
    // owner outside React from admission through the final disposal receipt.
    document.body.append(frame)
    returnButton.current?.focus()
    void compileNative(doc).then(bytes => {
      if (cancelled) return
      payload = { name: doc.meta.name.trim() || 'Untitled Acre', bytesBase64: bytesToBase64(bytes), accountUsername }
      start()
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'The test could not be started.')
      dispose()
    })
    return () => {
      cancelled = true
      if (disposed) return
      if (!started) { dispose(); return }
      // An admitted test must finish its hello and close its claimed authority.
      // Keep that disposable document alive until it confirms the socket is closed.
      frame.hidden = true
      frame.contentWindow?.postMessage({ type: 'solomon-editor-test-cancel' }, origin)
    }
  }, [doc, onReturn, accountUsername])

  return <div className="editor-test-runtime" data-editor-test-state={error ? 'error' : playing ? 'playing' : 'loading'}>
    {!playing && <div className="editor-test-loading">
      <div className="editor-test-card">
        <span className="editor-test-kicker">Boneyard workshop / Private test</span>
        <h2>{error ? 'Your draft is safe' : doc.meta.name || 'Untitled Acre'}</h2>
        <p role={error ? 'alert' : 'status'}>{error ?? stage}</p>
        {!error && <div className="editor-test-progress" aria-hidden><span /></div>}
        <p className="editor-test-detail">Explore your scenery and terrain with a fresh wizard. Test progress is discarded when you return.</p>
        <p className="editor-test-limit">This preview lets you explore the layout. Authored scripts, recipes and custom wave overlays are not played yet.</p>
      </div>
    </div>}
    <div className="editor-test-bar">
      <div><span className="editor-test-dot" aria-hidden /><strong>Private test</strong><span className="editor-test-map-name">{doc.meta.name || 'Untitled Acre'}</span><small>No saved progress</small></div>
      <button ref={returnButton} type="button" className="btn btn-gold" onClick={onReturn}>← Return to editing</button>
    </div>
  </div>
}
