import type { GameSnapshot } from './protocol/game-state.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import type { GameLoopCue } from './game-audio-native.ts'
import { hubAudioAttenuation } from './game-audio-native.ts'
import { nativeFireImpactPitch } from './core-kernels/primary-spell-fire-native.ts'

const LOOP_CUES: readonly GameLoopCue[] = [
  'gather-rocks-loop',
  'ice-loop',
  'lightning-loop',
  'rolling-stone-loop',
]

export class PrimarySpellAudioSynchronizer {
  private readonly audio: GameAudioDirector
  private readonly localPlayerId: string
  private readonly loopOwners = new Map<GameLoopCue, Set<string>>()
  private previous: GameSnapshot

  constructor(
    audio: GameAudioDirector,
    localPlayerId: string,
    initialSnapshot: GameSnapshot,
  ) {
    this.audio = audio
    this.localPlayerId = localPlayerId
    this.previous = initialSnapshot
    for (const cue of LOOP_CUES) this.loopOwners.set(cue, new Set())
    this.syncLoops(initialSnapshot)
  }

  update(snapshot: GameSnapshot): void {
    const listener = snapshot.players[this.localPlayerId]
    const listenerWorldKey = worldKeyForPlayer(snapshot, this.localPlayerId)
    if (listener && listenerWorldKey) {
      for (const [playerId, player] of Object.entries(snapshot.players)) {
        if (worldKeyForPlayer(snapshot, playerId) !== listenerWorldKey) continue
        const previous = this.previous.players[playerId]
        if (!previous) continue
        const volume = hubAudioAttenuation(Math.hypot(
          player.position.x - listener.position.x,
          player.position.y - listener.position.y,
        ))
        if (player.primaryCast.castSequence > previous.primaryCast.castSequence) {
          switch (player.config.element) {
            case 'air': this.audio.playSound('lightning-start', { volume }); break
            case 'earth': this.audio.playSound('start-boulder', { volume }); break
            case 'water': this.audio.playSound('ice-start', { volume }); break
            case 'ether':
            case 'fire':
              break
          }
        }
        if (player.primaryCast.emissionSequence > previous.primaryCast.emissionSequence) {
          switch (player.config.element) {
            case 'ether': this.audio.playSound('magic-missile', { volume }); break
            case 'fire': this.audio.playSound('throw-fire', { volume }); break
            case 'air':
            case 'earth':
            case 'water':
              break
          }
        }
      }
      const previousFireImpacts = new Set(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'fire-impact')
        .map((effect) => effect.id))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'fire-impact'
          || effect.worldKey !== listenerWorldKey
          || previousFireImpacts.has(effect.id)
        ) continue
        this.audio.playSound('fireball-hit', {
          playbackRate: nativeFireImpactPitch(effect.id),
          volume: hubAudioAttenuation(Math.hypot(
            effect.origin.x - listener.position.x,
            effect.origin.y - listener.position.y,
          )),
        })
      }
    }
    this.syncLoops(snapshot)
    this.previous = snapshot
  }

  destroy(): void {
    for (const [cue, owners] of this.loopOwners) {
      for (const owner of owners) this.audio.stopLoop(cue, owner)
      owners.clear()
    }
  }

  private syncLoops(snapshot: GameSnapshot): void {
    const desired = new Map<GameLoopCue, Set<string>>(
      LOOP_CUES.map((cue) => [cue, new Set<string>()]),
    )
    const listenerWorldKey = worldKeyForPlayer(snapshot, this.localPlayerId)
    if (listenerWorldKey) {
      for (const [playerId, player] of Object.entries(snapshot.players)) {
        if (
          !player.primaryCast.channelActive
          || worldKeyForPlayer(snapshot, playerId) !== listenerWorldKey
        ) continue
        const owner = `primary-player:${playerId}`
        switch (player.config.element) {
          case 'air': desired.get('lightning-loop')!.add(owner); break
          case 'earth': {
            const gathering = snapshot.primarySpells.projectiles.some((spell) => (
              spell.kind === 'earth'
              && spell.ownerId === playerId
              && spell.phase === 'held'
              && spell.charge < 1
              && spell.worldKey === listenerWorldKey
            ))
            if (gathering) desired.get('gather-rocks-loop')!.add(owner)
            break
          }
          case 'water': desired.get('ice-loop')!.add(owner); break
          case 'ether':
          case 'fire':
            break
        }
      }
      for (const spell of snapshot.primarySpells.projectiles) {
        if (
          spell.kind === 'earth'
          && spell.phase === 'flight'
          && spell.worldKey === listenerWorldKey
        ) desired.get('rolling-stone-loop')!.add(`primary-spell:${spell.id}`)
      }
    }

    for (const cue of LOOP_CUES) {
      const current = this.loopOwners.get(cue)!
      const next = desired.get(cue)!
      for (const owner of next) {
        if (current.has(owner)) continue
        this.audio.startLoop(cue, owner)
      }
      for (const owner of current) {
        if (next.has(owner)) continue
        this.audio.stopLoop(cue, owner)
      }
      this.loopOwners.set(cue, next)
    }
  }
}

function worldKeyForPlayer(snapshot: GameSnapshot, playerId: string): string | null {
  if (!snapshot.players[playerId]) return null
  return snapshot.world.kind === 'hub'
    ? `hub:${snapshot.world.participants[playerId]?.region ?? 'courtyard'}`
    : `boneyard:${snapshot.world.runId}`
}
