import { useEffect, useRef, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import { loadModGameAudioAsset } from '../game-audio-browser.ts'
import type { GameAudioDirector } from '../game-audio-director.ts'
import { gameContentUrl } from '../game-content-cache.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'

interface ActiveAudio {
  readonly bus: string
  readonly source: string
}

export default function ModAudio({
  audio,
  session,
}: Readonly<{ audio: GameAudioDirector; session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  const active = useRef(new Map<string, ActiveAudio>())
  const desired = useRef(new Map<string, ActiveAudio>())
  const heard = useRef(new Set<string>())
  useEffect(() => session.onModRuntime(setRuntime), [session])
  useEffect(() => {
    const next = new Map<string, ActiveAudio>()
    for (const row of rows(runtime?.audio_loops)) {
      const owner = text(row.owner)
      const source = sourceFor(session, row)
      if (owner && source) next.set(owner, { bus: text(row.bus), source })
    }
    desired.current = next
    for (const [owner, current] of active.current) {
      const wanted = next.get(owner)
      if (wanted?.source === current.source && wanted.bus === current.bus) continue
      stop(audio, owner, current.bus)
      active.current.delete(owner)
    }
    for (const [owner, wanted] of next) {
      if (active.current.has(owner)) continue
      if (wanted.bus === 'music') {
        audio.startAssetMusic(owner, wanted.source, volume(rows(runtime?.audio_loops), owner))
        active.current.set(owner, wanted)
      } else void loadModGameAudioAsset(wanted.source).then(() => {
        if (desired.current.get(owner)?.source !== wanted.source) return
        audio.startAssetLoop(owner, wanted.source, { volume: volume(rows(runtime?.audio_loops), owner) })
        active.current.set(owner, wanted)
      }, () => undefined)
    }
    const tick = session.getSnapshot().tick
    for (const event of rows(runtime?.presentation_events)) {
      const sequence = `${text(event.mod_id)}:${integer(event.sequence)}`
      const source = sourceFor(session, event)
      if (!source || heard.current.has(sequence) || tick - integer(event.tick) > 20) continue
      heard.current.add(sequence)
      void loadModGameAudioAsset(source).then(() => audio.playAsset(source, {
        volume: finite(event.volume),
      }), () => undefined)
    }
  }, [audio, runtime, session])
  useEffect(() => () => {
    for (const [owner, current] of active.current) stop(audio, owner, current.bus)
    active.current.clear()
    desired.current.clear()
  }, [audio])
  return null
}

function stop(audio: GameAudioDirector, owner: string, bus: string): void {
  if (bus === 'music') audio.stopAssetMusic(owner)
  else audio.stopAssetLoop(owner)
}

function sourceFor(session: GameClientSession, row: LuaConsoleObject): string | null {
  const asset = session.modAssets.find(candidate => (
    candidate.modId === row.mod_id && candidate.path === row.path && candidate.kind === 'audio'
  ))
  return asset ? gameContentUrl(asset) : null
}

function volume(values: LuaConsoleObject[], owner: string): number {
  return finite(values.find(row => row.owner === owner)?.volume)
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}

function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function integer(value: unknown): number { return Number.isSafeInteger(value) ? Number(value) : 0 }
function finite(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
