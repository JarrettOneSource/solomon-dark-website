import { lazy, Suspense } from 'react'
import type { EditorDoc } from './model.ts'

// Test-play runs the Rust game on every Website build. PixiEditorTestRuntime.tsx
// stays with the rest of the PixiJS client until that client is removed.
const TestRuntime = lazy(() => import('./RustEditorTestRuntime.tsx'))

export default function EditorTestRuntime(props: {
  accountUsername: string | null
  doc: EditorDoc
  onReturn: () => void
}) {
  return <Suspense fallback={<div className="editor-test-loading">Preparing your Boneyard…</div>}>
    <TestRuntime {...props} />
  </Suspense>
}
