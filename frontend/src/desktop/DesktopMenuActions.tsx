import { useState, useSyncExternalStore } from 'react'
import { getDesktopPeerRuntime } from './peer-runtime.ts'
import './desktop-menu.css'

export default function DesktopMenuActions() {
  return window.solomonDarkRuntime?.desktop
    ? <DesktopFriends />
    : <a className="desktop-download-link" href="/download">Download Offline</a>
}

function DesktopFriends() {
  const runtime = getDesktopPeerRuntime()
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const busy = state.phase === 'connecting'
  const act = async (operation: () => Promise<void>) => {
    setNotice(null)
    try { await operation() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Friend connection failed') }
  }
  return (
    <div className="desktop-friends">
      <button className="desktop-download-link" onClick={() => setOpen(value => !value)}>
        {state.mode === 'solo' ? 'Play with friends' : `Friends: ${state.mode === 'host' ? 'Hosting' : 'Joining'} (${state.connectedPeers})`}
      </button>
      {open && <section className="desktop-friends-panel" aria-label="Desktop friend play">
        <h2>Play with friends</h2>
        <p>One player hosts the game on their own computer. Nearby hosts give nearby friends the best connection.</p>
        <div className="desktop-friends-actions">
          <button disabled={busy} onClick={() => { void act(runtime.host) }}>Host friends</button>
          <button onClick={() => { runtime.stop(); setNotice(null) }}>Play offline alone</button>
        </div>
        {state.invite && <div>
          <label>Your invitation code
            <input readOnly value={state.invite} onFocus={event => event.target.select()} />
          </label>
          <button onClick={() => {
            void navigator.clipboard.writeText(state.invite!).then(() => setNotice('Invitation copied.'))
              .catch(() => setNotice('Select the code and copy it with your keyboard.'))
          }}>Copy invitation</button>
          <p>Share this code privately. Closing this app disconnects your friends.</p>
        </div>}
        <form onSubmit={event => { event.preventDefault(); void act(() => runtime.join(code)) }}>
          <label>Join a friend
            <input value={code} onChange={event => setCode(event.target.value)} placeholder="Paste invitation code" autoComplete="off" maxLength={64} />
          </label>
          <button disabled={busy || !code.trim()} type="submit">Join friend</button>
        </form>
        {busy && <p role="status">Connecting…</p>}
        {state.phase === 'ready' && <p role="status">
          {state.mode === 'host' ? `Hosting locally. ${state.connectedPeers} friend(s) connected.` : 'Connected to your friend.'}
          {' '}Choose Done, then Play → New game to enter the College. Form your party in the College.
        </p>}
        {(notice || state.error) && <p role="status">{notice || state.error}</p>}
        <button onClick={() => setOpen(false)}>Done</button>
      </section>}
    </div>
  )
}
