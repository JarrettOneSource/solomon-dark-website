import type { GameSnapshot } from './protocol/game-state.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  hubAudioAttenuation,
  type GameLoopCue,
  type GameSoundCue,
  type SecondaryStreamCue,
} from './game-audio-native.ts'
import type { NativeSecondaryAudioCue } from './core-kernels/native-secondary-abilities.ts'
import {
  playerAudioAttenuation,
  playerAudioWorldKey,
} from './game-audio-spatial.ts'
import { nativeFireImpactPitch } from './core-kernels/primary-spell-fire-native.ts'
import { nativeEtherImpactPitch } from './core-kernels/primary-spell-ether-native.ts'

const LOOP_CUES: readonly GameLoopCue[] = [
  'comet-loop',
  'electric-loop',
  'earthquake-loop',
  'gather-rocks-loop',
  'ice-loop',
  'lightning-loop',
  'low-fire-loop',
  'plane-cross-loop',
  'rainfall-loop',
  'rolling-stone-loop',
  'steady-wind-loop',
]

const SECONDARY_STREAM_CUES = new Set<NativeSecondaryAudioCue>([
  'dampen', 'golem-die', 'golem-provoke', 'leviathan-roar', 'mindstar',
  'planewalker-off', 'planewalker-on', 'prismatic-shock', 'quake-crack-small',
  'quake-cracks', 'set-trap', 'stoneskin-on', 'thunder', 'trap',
])

const SECONDARY_LOOP_CUES = new Set<NativeSecondaryAudioCue>([
  'comet-loop', 'electric-loop', 'earthquake-loop', 'low-fire-loop', 'plane-cross-loop',
  'rainfall-loop', 'steady-wind-loop',
])

export class PrimarySpellAudioSynchronizer {
  private readonly audio: GameAudioDirector
  private readonly localPlayerId: string
  private readonly loopOwners = new Map<GameLoopCue, Map<string, number>>()
  private previous: GameSnapshot

  constructor(
    audio: GameAudioDirector,
    localPlayerId: string,
    initialSnapshot: GameSnapshot,
  ) {
    this.audio = audio
    this.localPlayerId = localPlayerId
    this.previous = initialSnapshot
    for (const cue of LOOP_CUES) this.loopOwners.set(cue, new Map())
    this.syncLoops(initialSnapshot)
  }

  update(snapshot: GameSnapshot): void {
    const listener = snapshot.players[this.localPlayerId]
    const listenerWorldKey = playerAudioWorldKey(snapshot, this.localPlayerId)
    if (listener && listenerWorldKey) {
      for (const [playerId, player] of Object.entries(snapshot.players)) {
        const previous = this.previous.players[playerId]
        if (!previous) continue
        const volume = playerAudioAttenuation(
          snapshot,
          this.localPlayerId,
          playerId,
        )
        if (volume === null) continue
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
        if (player.primaryCast.fizzleSequence > previous.primaryCast.fizzleSequence) {
          const earthVolume = player.config.element === 'earth'
            ? this.earthFizzleVolume(snapshot, playerId, volume)
            : volume
          this.audio.playSound('fizzle', {
            playbackRate: player.config.element === 'earth' ? 0.5 : 1,
            volume: earthVolume,
          })
        }
        if (player.primaryCast.emissionSequence > previous.primaryCast.emissionSequence) {
          const launchVolume = volume * (player.primaryCast.underpowered ? 0.75 : 1)
          switch (player.config.element) {
            case 'ether': this.audio.playSound('magic-missile', { volume: launchVolume }); break
            case 'fire': this.audio.playSound('throw-fire', { volume: launchVolume }); break
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
      for (const event of snapshot.secondaryAbilities.events) {
        if (
          event.eventId < this.previous.secondaryAbilities.nextEventId
          || event.worldKey !== listenerWorldKey
          || event.cue === null
          || SECONDARY_LOOP_CUES.has(event.cue)
        ) continue
        const volume = hubAudioAttenuation(Math.hypot(
          event.position.x - listener.position.x,
          event.position.y - listener.position.y,
        ))
        if (SECONDARY_STREAM_CUES.has(event.cue)) {
          this.audio.playStream(event.cue as SecondaryStreamCue, {
            playbackRate: event.pitch,
            volume,
          })
        } else {
          this.audio.playSound(event.cue as GameSoundCue, {
            playbackRate: event.pitch,
            volume,
          })
        }
      }
      const previousEtherImpacts = new Set(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'ether-impact')
        .map((effect) => effect.id))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'ether-impact'
          || effect.worldKey !== listenerWorldKey
          || previousEtherImpacts.has(effect.id)
        ) continue
        this.audio.playSound('magic-missile-hit', {
          playbackRate: nativeEtherImpactPitch(effect.id),
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
      for (const owner of owners.keys()) this.audio.stopLoop(cue, owner)
      owners.clear()
    }
  }

  private syncLoops(snapshot: GameSnapshot): void {
    const desired = new Map<GameLoopCue, Map<string, number>>(
      LOOP_CUES.map((cue) => [cue, new Map<string, number>()]),
    )
    const listenerWorldKey = playerAudioWorldKey(snapshot, this.localPlayerId)
    if (listenerWorldKey) {
      for (const [playerId, player] of Object.entries(snapshot.players)) {
        if (
          !player.primaryCast.channelActive
          || playerAudioWorldKey(snapshot, playerId) !== listenerWorldKey
        ) continue
        const owner = `primary-player:${playerId}`
        const attenuation = playerAudioAttenuation(
          snapshot,
          this.localPlayerId,
          playerId,
        )
        if (attenuation === null) continue
        switch (player.config.element) {
          case 'air':
            desired.get('lightning-loop')!.set(
              owner,
              attenuation * (player.primaryCast.underpowered ? 0.75 : 1),
            )
            break
          case 'earth': {
            const gathering = snapshot.primarySpells.projectiles.some((spell) => (
              spell.kind === 'earth'
              && spell.ownerId === playerId
              && spell.phase === 'held'
              && spell.charge < 1
              && spell.worldKey === listenerWorldKey
            ))
            if (gathering) desired.get('gather-rocks-loop')!.set(owner, attenuation)
            break
          }
          case 'water':
            desired.get('ice-loop')!.set(
              owner,
              attenuation * (player.primaryCast.underpowered ? 0.5 : 1),
            )
            break
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
        ) {
          const listener = snapshot.players[this.localPlayerId]
          if (!listener) continue
          desired.get('rolling-stone-loop')!.set(
            `primary-spell:${spell.id}`,
            hubAudioAttenuation(Math.hypot(
              spell.position.x - listener.position.x,
              spell.position.y - listener.position.y,
            )),
          )
        }
      }
      const listener = snapshot.players[this.localPlayerId]
      if (listener) {
        const requestSecondaryLoop = (
          cue: GameLoopCue,
          ownerId: string,
          position: Readonly<{ x: number; y: number }>,
        ) => {
          const volume = hubAudioAttenuation(Math.hypot(
            position.x - listener.position.x,
            position.y - listener.position.y,
          ))
          const owner = `secondary-player:${ownerId}`
          const loops = desired.get(cue)!
          loops.set(owner, Math.max(loops.get(owner) ?? 0, volume))
        }
        for (const [ownerId, secondaryPlayer] of Object.entries(
          snapshot.secondaryAbilities.players,
        )) {
          if (secondaryPlayer.planewalkerTicksRemaining <= 0) continue
          if (playerAudioWorldKey(snapshot, ownerId) !== listenerWorldKey) continue
          const owner = snapshot.players[ownerId]
          if (!owner) continue
          requestSecondaryLoop('plane-cross-loop', ownerId, owner.position)
        }
        for (const actor of snapshot.secondaryAbilities.actors) {
          if (actor.worldKey !== listenerWorldKey) continue
          switch (actor.kind) {
            case 'leviathan':
            case 'ether-drain':
              requestSecondaryLoop('plane-cross-loop', actor.ownerId, actor.position)
              break
            case 'moving-fire':
            case 'fire-patch':
              requestSecondaryLoop('low-fire-loop', actor.ownerId, actor.position)
              break
            case 'storm-cloud':
              requestSecondaryLoop('rainfall-loop', actor.ownerId, actor.position)
              requestSecondaryLoop('steady-wind-loop', actor.ownerId, actor.position)
              break
            case 'acid-rain':
              requestSecondaryLoop('rainfall-loop', actor.ownerId, actor.position)
              break
            case 'earthquake':
              requestSecondaryLoop('earthquake-loop', actor.ownerId, actor.position)
              break
            case 'comet':
              requestSecondaryLoop('comet-loop', actor.ownerId, actor.position)
              break
            case 'electric-burn':
              if (actor.ageTicks > 0) {
                requestSecondaryLoop('electric-loop', actor.ownerId, actor.position)
              }
              break
            default:
              break
          }
          if (actor.kind === 'ether-drain') {
            requestSecondaryLoop('steady-wind-loop', actor.ownerId, actor.position)
          }
        }
      }
    }

    for (const cue of LOOP_CUES) {
      const current = this.loopOwners.get(cue)!
      const next = desired.get(cue)!
      for (const [owner, volume] of next) {
        if (current.get(owner) === volume) continue
        this.audio.startLoop(cue, owner, { volume })
      }
      for (const owner of current.keys()) {
        if (next.has(owner)) continue
        this.audio.stopLoop(cue, owner)
      }
      this.loopOwners.set(cue, next)
    }
  }

  private earthFizzleVolume(
    snapshot: GameSnapshot,
    playerId: string,
    fallback: number,
  ): number {
    const listener = snapshot.players[this.localPlayerId]
    const boulder = snapshot.primarySpells.projectiles.find((spell) => (
      spell.kind === 'earth' && spell.ownerId === playerId
    ))
    if (!listener || !boulder) return fallback * 0.5
    return hubAudioAttenuation(Math.hypot(
      boulder.position.x - listener.position.x,
      boulder.position.y - listener.position.y,
    )) * 0.5
  }
}
