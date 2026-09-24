import { useCallback, useLayoutEffect, useState } from 'react'
import type { GameClientSession } from './client/game-client-session.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { NativeLootMessagePresentation, type NativeLootMessageVisual } from './loot-message-presentation.ts'
import { NativeSkillBookFeedbackCursor, nativeSkillBookWorldMessage } from './skill-book-feedback.ts'

interface SkillBookFeedbackState {
  readonly session: GameClientSession | null
  readonly skillId: number | null
  readonly hubMessages: readonly NativeLootMessageVisual[]
}

/** The result outlives Inventory; MainMenu retains its existing pause until OKAY. */
export function useSkillBookFeedback(session: GameClientSession | null, audio: GameAudioDirector) {
  const [state, setState] = useState<SkillBookFeedbackState>({ session: null, skillId: null, hubMessages: [] })
  useLayoutEffect(() => {
    setState({ session, skillId: null, hubMessages: [] })
    if (session === null) return
    const initial = session.getSnapshot()
    let cursor = new NativeSkillBookFeedbackCursor(initial.players[session.playerId]?.economy.actionFeedback ?? null)
    let messages = new NativeLootMessagePresentation(initial.tick)
    let worldKey = initial.world.kind === 'boneyard' ? initial.world.runId : 'hub'
    const unsubscribe = session.onSnapshot(snapshot => {
      const feedback = snapshot.players[session.playerId]?.economy.actionFeedback ?? null
      const nextWorldKey = snapshot.world.kind === 'boneyard' ? snapshot.world.runId : 'hub'
      if (nextWorldKey !== worldKey || !snapshot.players[session.playerId]
        || snapshot.run.phase === 'game-over' || snapshot.run.phase === 'loadout') {
        audio.stopStream('magic-book-get')
        worldKey = nextWorldKey
        cursor = new NativeSkillBookFeedbackCursor(feedback)
        messages = new NativeLootMessagePresentation(snapshot.tick)
        setState(current => current.skillId === null && current.hubMessages.length === 0
          ? current : { session, skillId: null, hubMessages: [] })
        return
      }
      const received = cursor.consume(feedback)
      if (received !== null) {
        audio.playStream('magic-book-get')
        const skillId = received.outcome.kind === 'rank' ? received.outcome.skillId : null
        if (skillId !== null && snapshot.world.kind === 'hub') {
          messages.consumeText(nativeSkillBookWorldMessage(received.sequence, skillId, snapshot.tick))
        }
        setState(current => ({ ...current, skillId }))
      }
      const hubMessages = messages.sample(snapshot.tick)
      setState(current => current.hubMessages.length === 0 && hubMessages.length === 0
        ? current : { ...current, hubMessages })
    })
    return () => { unsubscribe(); audio.stopStream('magic-book-get') }
  }, [audio, session])
  const dismiss = useCallback(() => {
    audio.playSound('click')
    setState(current => ({ ...current, skillId: null }))
  }, [audio])
  return {
    skillId: state.session === session ? state.skillId : null,
    hubMessages: state.session === session ? state.hubMessages : [],
    dismiss,
  }
}

