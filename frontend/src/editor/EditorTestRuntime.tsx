import { useEffect, useRef, useState } from 'react'
import MainMenuScene from '../game/MainMenuScene.tsx'
import { bootGame, type GameSession } from '../game/engine.ts'
import { loadGameStartupAssets } from '../game/game-assets.ts'
import { admitEditorTest } from '../game/game-bootstrap.ts'
import { gameOnlinePreferences, readGameSettings } from '../game/game-settings.ts'
import type { NativeSaveTransferController } from '../game/NativeSaveTransferSettings.tsx'
import { getToken } from '../lib/api.ts'
import { bytesToBase64, compileNative } from './io.ts'
import type { EditorDoc } from './model.ts'

const unavailable = async (): Promise<never> => { throw new Error('This is a disposable editor test.') }
const ignore = () => {}
const ignoreAsync = async () => {}
const noEntries = async () => []
const noSaveTransfer: NativeSaveTransferController = {
  canExport: false,
  exportCurrent: unavailable,
  inspectImport: unavailable,
  replaceWithImport: unavailable,
}

/** Owns one transient authority. The editor remains mounted beneath this surface. */
export default function EditorTestRuntime({ doc, onReturn }: { doc: EditorDoc; onReturn: () => void }) {
  const [session, setSession] = useState<GameSession | null>(null)
  const [stage, setStage] = useState('Preparing your Boneyard')
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<GameSession | null>(null)
  const returnButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    let owned: GameSession | null = null
    returnButton.current?.focus()
    const fail = (message: string) => {
      if (cancelled) return
      owned?.destroy()
      setSession(null)
      setError(message)
    }
    void (async () => {
      const bytes = await compileNative(doc)
      if (cancelled) return
      setStage('Loading the test world')
      await loadGameStartupAssets(() => {})
      if (cancelled) return
      setStage('Starting a private test')
      const endpoint = await admitEditorTest({
        name: doc.meta.name.trim() || 'Untitled Acre', bytesBase64: bytesToBase64(bytes),
      }, getToken())
      // Complete an already admitted connection even after cancellation, so its
      // socket can be closed and the claimed ephemeral authority is reaped.
      owned = await bootGame({
        endpoint,
        character: { discipline: 'arcane', displayName: 'Test Wizard', element: 'ether' },
        cheatsEnabled: false,
        enhancedEffects: readGameSettings().enhancedEffects,
        onlinePreferences: { ...gameOnlinePreferences(readGameSettings()), submitRuns: false },
        profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: 0 },
        onFatal: failure => fail(failure.message),
        onDeploymentRestart: async () => fail('The game was updated. Return to editing and start a new test.'),
      })
      if (cancelled) { owned.destroy(); return }
      sessionRef.current = owned
      const choice = owned.boneyards.find(item => item.id === 'editor-test')
      if (!choice) throw new Error('The private test did not receive your Boneyard.')
      owned.startMatch(choice.id)
      setSession(owned)
    })().catch((cause: unknown) => fail(cause instanceof Error ? cause.message : 'The test could not be started.'))
    return () => {
      cancelled = true
      owned?.destroy()
      sessionRef.current = null
    }
  }, [doc])

  const leave = () => {
    sessionRef.current?.destroy()
    onReturn()
  }

  return <div className="editor-test-runtime" data-editor-test-state={error ? 'error' : session ? 'playing' : 'loading'}>
    {session ? <MainMenuScene
      activeMods={[]}
      accountUsername={null}
      connectSession={unavailable}
      connectObserver={unavailable}
      developerAccess={false}
      displayName="Test Wizard"
      editorTestSession={session}
      loadGlobalHallOfFame={noEntries}
      modLoadError={null}
      onCancelCreate={ignoreAsync}
      onKillWizard={unavailable}
      onReturnToEditor={leave}
      onSaveCheckpoint={ignore}
      onSignOut={ignore}
      persistSaveCheckpoint={ignoreAsync}
      prepareGame={unavailable}
      profileSave={null}
      refreshActiveMods={noEntries}
      resumeSave={null}
      saveTransfer={noSaveTransfer}
      submitGlobalHallOfFame={ignoreAsync}
      tutorialOfferEligible={false}
    /> : <div className="editor-test-loading">
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
      <button ref={returnButton} type="button" className="btn btn-gold" onClick={leave}>← Return to editing</button>
    </div>
  </div>
}
