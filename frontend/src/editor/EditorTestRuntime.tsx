import { lazy, Suspense } from 'react'
import { gameRuntime } from '../lib/game-runtime.ts'
import type { EditorDoc } from './model.ts'

const TestRuntime = gameRuntime === 'rust'
  ? lazy(() => import('./RustEditorTestRuntime.tsx'))
  : lazy(() => import('./PixiEditorTestRuntime.tsx'))

export default function EditorTestRuntime(props: {
  accountUsername: string | null
  doc: EditorDoc
  onReturn: () => void
}) {
  return <Suspense fallback={<div className="editor-test-loading">Preparing your Boneyard…</div>}>
    <TestRuntime {...props} />
  </Suspense>
}
