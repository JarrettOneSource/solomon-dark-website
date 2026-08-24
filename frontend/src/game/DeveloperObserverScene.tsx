import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import BoneyardScene from './BoneyardScene.tsx'
import type { GameAudioDirector } from './game-audio-director.ts'
import type { GameObserverSession, GameObserverState } from './client/game-observer-session.ts'
import type { GameSettings } from './game-settings.ts'
import {
  deriveObserverSkillEvents,
  observerSkillOffers,
  type ObserverSkillEvent,
} from './observer-activity.ts'
import './developer-observer.css'

const ignore = () => {}

export default function DeveloperObserverScene({
  accountUsername,
  audio,
  nativeUiStageStyle,
  onExit,
  session,
  settings,
}: {
  accountUsername: string | null
  audio: GameAudioDirector
  nativeUiStageStyle: CSSProperties
  onExit: () => void
  session: GameObserverSession
  settings: GameSettings
}) {
  const [observerState, setObserverState] = useState<GameObserverState>(() => session.current())
  const [selectedPlayerId, setSelectedPlayerId] = useState(observerState.viewPlayerId)
  const [skillEvents, setSkillEvents] = useState<readonly ObserverSkillEvent[]>([])
  const previousSnapshot = useRef(observerState.snapshot)

  useEffect(() => session.subscribe((next) => {
    const derived = deriveObserverSkillEvents(previousSnapshot.current, next.snapshot)
    previousSnapshot.current = next.snapshot
    if (derived.length > 0) {
      setSkillEvents(current => [...current, ...derived].slice(-32))
    }
    setObserverState(next)
    setSelectedPlayerId(current => next.snapshot.players[current]
      ? current
      : next.viewPlayerId)
  }), [session])

  const playerIds = Object.keys(observerState.snapshot.players)
  const selectedPlayer = observerState.snapshot.players[selectedPlayerId]
    ?? observerState.snapshot.players[observerState.viewPlayerId]
  const offers = observerSkillOffers(observerState.snapshot)
  const chats = observerState.chatMessages.slice(-24)
  const subscribeSnapshot = useMemo(() => (
    listener: (snapshot: GameObserverState['snapshot']) => void,
  ) => session.subscribe(state => listener(state.snapshot)), [session])
  const subscribePing = useMemo(() => (listener: (pingMs: number) => void) => {
    let previous: number | null = null
    return session.subscribe(state => {
      if (state.pingMs === null || state.pingMs === previous) return
      previous = state.pingMs
      listener(state.pingMs)
    })
  }, [session])

  if (!selectedPlayer) return null
  return (
    <section className="developer-observer-scene" aria-label="Developer match observer">
      <BoneyardScene
        key={`${observerState.boneyard.runId}:${selectedPlayerId}`}
        accountUsername={accountUsername}
        audio={audio}
        boneyard={observerState.boneyard}
        getPingMs={() => observerState.pingMs}
        initialSnapshot={observerState.snapshot}
        inputBlocked
        inventoryRequestSequence={0}
        levelUpPresentationId={null}
        modAssets={session.modAssets}
        modCatalog={session.modCatalog}
        nativeUiStageStyle={nativeUiStageStyle}
        onContinueGameOver={ignore}
        onHubAction={ignore}
        onInput={ignore}
        onInventoryOpenChange={ignore}
        onLoadingError={onExit}
        onOpenSkillSelector={ignore}
        onOpenSkills={ignore}
        onPauseRequest={onExit}
        onReady={ignore}
        onTutorialAction={ignore}
        playerId={selectedPlayerId}
        presentationPaused={false}
        progression={selectedPlayer.progression}
        samplePresentation={session.samplePresentation}
        settings={settings}
        subscribe={subscribeSnapshot}
        subscribeEnemyEvent={session.subscribeEnemyEvent}
        subscribePing={subscribePing}
        worldSpeeches={[]}
      />
      <aside className="developer-observer-panel">
        <header>
          <div>
            <strong>DEVELOPER OBSERVER</strong>
            <span>{observerState.boneyard.choice.name} · NO PARTICIPANT</span>
          </div>
          <button type="button" onClick={onExit}>EXIT</button>
        </header>
        <div className="developer-observer-targets">
          <span>CAMERA</span>
          {playerIds.map(playerId => (
            <button
              type="button"
              className={playerId === selectedPlayerId ? 'selected' : undefined}
              key={playerId}
              onClick={() => setSelectedPlayerId(playerId)}
            >
              {observerState.snapshot.players[playerId]!.config.displayName}
            </button>
          ))}
        </div>
        <section>
          <h2>SKILL PICKS</h2>
          {offers.length === 0 ? <p>NO ACTIVE SKILL CHOICE.</p> : offers.map(offer => (
            <article key={offer.id}>
              <strong>{offer.playerName} · {offer.title}</strong>
              <span>{offer.options.join(' · ')}</span>
            </article>
          ))}
          {skillEvents.slice(-8).map(event => (
            <article className="resolved" key={event.id}>
              <strong>{event.playerName} · {event.title}</strong>
              <span>{event.detail}</span>
            </article>
          ))}
        </section>
        <section>
          <h2>ALL MATCH CHAT</h2>
          {chats.length === 0 ? <p>NO CHAT YET.</p> : chats.map(chat => (
            <article key={chat.sequence}>
              <strong>
                [{chat.channel.toUpperCase()}] {chat.sender.displayName}
                {chat.recipient ? ` → ${chat.recipient.displayName}` : ''}
              </strong>
              <span>{chat.text}</span>
            </article>
          ))}
        </section>
      </aside>
    </section>
  )
}
