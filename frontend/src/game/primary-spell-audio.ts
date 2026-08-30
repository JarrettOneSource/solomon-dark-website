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
import {
  nativeEarthBoulderRockHitPitch,
  nativeEarthBoulderStoneBreakPitch,
} from './core-kernels/native-earth-boulder.ts'
import { newNativeAirWaterActorSoundRequests } from './air-water-skill-audio.ts'
import type { NativeWeldBuildId } from './core-kernels/native-weld-primary-profile.ts'
import {
  nativeWeldCastSoundCues,
  nativeWeldLoopCues,
} from './weld-primary-audio-contract.ts'

const LOOP_CUES: readonly GameLoopCue[] = [
  'comet-loop',
  'electric-loop',
  'earthquake-loop',
  'fire-loop',
  'gather-rocks-loop',
  'ice-beam-loop',
  'ice-loop',
  'lightning-loop',
  'low-fire-loop',
  'meteor-loop',
  'plane-cross-loop',
  'rainfall-loop',
  'rolling-stone-loop',
  'steady-wind-loop',
  'steam-loop',
]

const SECONDARY_STREAM_CUES = new Set<NativeSecondaryAudioCue>([
  'dampen', 'golem-die', 'golem-provoke', 'leviathan-roar', 'mindstar',
  'planewalker-off', 'planewalker-on', 'prismatic-shock', 'quake-crack-small',
  'quake-cracks', 'set-trap', 'stoneskin-on', 'thunder', 'trap',
])

interface PrimaryLoopMix {
  readonly playbackRate: number
  readonly volume: number
}

const SECONDARY_LOOP_CUES = new Set<NativeSecondaryAudioCue>([
  'comet-loop', 'electric-loop', 'earthquake-loop', 'low-fire-loop', 'plane-cross-loop',
  'rainfall-loop', 'steady-wind-loop',
])

const GOOD_IMP_BOUNCE_CUES = Object.freeze([
  'imp-vocal-1', 'imp-vocal-2', 'imp-vocal-3', 'imp-vocal-4',
  'imp-vocal-5', 'imp-vocal-6', 'imp-vocal-7', 'imp-vocal-8',
] as const satisfies readonly GameSoundCue[])

const GOOD_IMP_CONTACT_CUES = Object.freeze([
  'bite-1', 'bite-2', 'bite-3',
] as const satisfies readonly GameSoundCue[])

export class PrimarySpellAudioSynchronizer {
  private readonly audio: GameAudioDirector
  private readonly localPlayerId: string
  private readonly loopOwners = new Map<GameLoopCue, Map<string, PrimaryLoopMix>>()
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
        const activeWeldBuildId = player.progression.selectedPrimarySkillId === 52
          ? nativeWeldBuildId(player.progression.weldBuildId)
          : null
        const primaryElement = selectedPrimaryElement(
          player.progression.selectedPrimarySkillId,
          player.config.element,
        )
        if (player.primaryCast.castSequence > previous.primaryCast.castSequence) {
          if (activeWeldBuildId !== null) {
            if (!isWeldOneShot(activeWeldBuildId)) {
              for (let sequence = previous.primaryCast.castSequence;
                sequence < player.primaryCast.castSequence;
                sequence += 1) {
                for (const cue of nativeWeldCastSoundCues(activeWeldBuildId, null)) {
                  this.audio.playSound(cue, {
                    playbackRate: player.primaryCast.lastWeldPlaybackRate ?? 1,
                    volume,
                  })
                }
              }
            }
          } else {
            switch (primaryElement) {
              case 'air': this.audio.playSound('lightning-start', { volume }); break
              case 'earth': this.audio.playSound('start-boulder', { volume }); break
              case 'water': this.audio.playSound('ice-start', { volume }); break
              case 'ether':
              case 'fire':
                break
            }
          }
        }
        if (player.primaryCast.fizzleSequence > previous.primaryCast.fizzleSequence) {
          const earthVolume = primaryElement === 'earth'
            ? this.earthFizzleVolume(snapshot, playerId, volume)
            : volume
          this.audio.playSound('fizzle', {
            playbackRate: primaryElement === 'earth' ? 0.5 : 1,
            volume: earthVolume,
          })
        }
        if (player.primaryCast.emissionSequence > previous.primaryCast.emissionSequence) {
          if (activeWeldBuildId !== null && isWeldOneShot(activeWeldBuildId)) {
            const playbackRate = player.primaryCast.lastWeldPlaybackRate
            if (playbackRate === null) {
              throw new Error(`weld build ${activeWeldBuildId} emitted without native playback rate`)
            }
            const count = player.primaryCast.emissionSequence
              - previous.primaryCast.emissionSequence
            for (let emission = 0; emission < count; emission += 1) {
              for (const cue of nativeWeldCastSoundCues(
                activeWeldBuildId,
                player.primaryCast.lastWeldSoundVariant,
              )) this.audio.playSound(cue, { playbackRate, volume })
            }
          } else if (activeWeldBuildId === null) {
            const playbackRate = player.primaryCast.underpowered ? 0.75 : 1
            switch (primaryElement) {
              case 'ether': this.audio.playSound('magic-missile', { playbackRate, volume }); break
              case 'fire': this.audio.playSound('throw-fire', { playbackRate, volume }); break
              case 'air':
              case 'earth':
              case 'water':
                break
            }
          }
        }
        for (
          let sequence = previous.primaryCast.etherBlastChargeCueSequence;
          sequence < player.primaryCast.etherBlastChargeCueSequence;
          sequence += 1
        ) {
          this.audio.playSound('magic-shield-up', { playbackRate: 2, volume })
        }
      }
      const previousEtherBlasts = new Set(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'ether-blast')
        .map((effect) => `${effect.worldKey}\u0000${effect.id}`))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'ether-blast'
          || effect.worldKey !== listenerWorldKey
          || previousEtherBlasts.has(`${effect.worldKey}\u0000${effect.id}`)
        ) continue
        const volume = playerAudioAttenuation(
          snapshot,
          this.localPlayerId,
          effect.ownerId,
        )
        if (volume === null) continue
        this.audio.playSound('lightning-start', { playbackRate: 2, volume })
        this.audio.playSound('goto-orb', { playbackRate: 0.75, volume })
        this.audio.playSound('goto-orb', { playbackRate: 0.5, volume })
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
      const previousFireExplosions = new Set(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'fire-explosion')
        .map((effect) => effect.id))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'fire-explosion'
          || effect.worldKey !== listenerWorldKey
          || previousFireExplosions.has(effect.id)
        ) continue
        const volume = 2 * hubAudioAttenuation(Math.hypot(
          effect.origin.x - listener.position.x,
          effect.origin.y - listener.position.y,
        ))
        if (effect.presentation === 'steam') {
          this.audio.playSound('explode-steam', {
            playbackRate: effect.soundPitch,
            volume,
          })
          continue
        }
        this.audio.playSound('fireball-hit', {
          playbackRate: effect.soundPitch,
          volume,
        })
        this.audio.playSound('throw-fire', {
          playbackRate: Math.fround(0.8),
          volume,
        })
      }
      const previousMeteors = new Map(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'weld-meteor')
        .map((effect) => [`${effect.worldKey}\u0000${effect.id}`, effect]))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'weld-meteor'
          || effect.phase !== 'impact'
          || effect.worldKey !== listenerWorldKey
          || previousMeteors.get(`${effect.worldKey}\u0000${effect.id}`)?.phase === 'impact'
        ) continue
        if (effect.impactSoundPitch === null) {
          throw new Error(`Meteor ${effect.id} impacted without its native sound pitch`)
        }
        const volume = effect.underpowered
          ? 1
          : 2 * hubAudioAttenuation(Math.hypot(
              effect.position.x - listener.position.x,
              effect.position.y - listener.position.y,
            ))
        this.audio.playSound('fireball-hit', {
          playbackRate: effect.impactSoundPitch,
          volume,
        })
        if (effect.impactThrowFirePitch !== null) {
          this.audio.playSound('throw-fire', {
            playbackRate: effect.impactThrowFirePitch,
            volume,
          })
        }
      }
      const previousWeldImpacts = new Set(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'weld-impact')
        .map((effect) => `${effect.worldKey}\u0000${effect.id}`))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'weld-impact'
          || effect.worldKey !== listenerWorldKey
          || previousWeldImpacts.has(`${effect.worldKey}\u0000${effect.id}`)
        ) continue
        const volume = hubAudioAttenuation(Math.hypot(
          effect.position.x - listener.position.x,
          effect.position.y - listener.position.y,
        ))
        if (effect.buildId === 1006 && effect.boulderTerminalCharge !== null) {
          const charge = effect.boulderTerminalCharge
          this.audio.playSound('rock-hit', {
            playbackRate: nativeEarthBoulderRockHitPitch(charge),
            volume: volume * charge,
          })
          const stoneBreakPitch = nativeEarthBoulderStoneBreakPitch(charge)
          this.audio.playSound('stone-break', {
            playbackRate: stoneBreakPitch,
            volume,
          })
        } else if (effect.buildId === 1001 && effect.impactSoundPitch !== null) {
          this.audio.playSound('ice-start', {
            playbackRate: effect.impactSoundPitch,
            volume,
          })
        } else if (effect.buildId === 1002 && effect.impactSoundPitch !== null) {
          this.audio.playSound('throw-lightning-1', {
            playbackRate: effect.impactSoundPitch,
            volume,
          })
        } else if (effect.buildId === 1009
          && effect.impactSoundPitch !== null
          && effect.impactSoundVariant !== null) {
          const cue = (['shock-1', 'shock-2', 'shock-3'] as const)[
            effect.impactSoundVariant
          ]!
          this.audio.playSound(cue, {
            playbackRate: effect.impactSoundPitch,
            volume,
          })
        }
      }
      const previousEarthImpacts = new Set(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'earth-impact')
        .map((effect) => `${effect.worldKey}\u0000${effect.id}`))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'earth-impact'
          || effect.worldKey !== listenerWorldKey
          || previousEarthImpacts.has(`${effect.worldKey}\u0000${effect.id}`)
        ) continue
        const volume = hubAudioAttenuation(Math.hypot(
          effect.origin.x - listener.position.x,
          effect.origin.y - listener.position.y,
        ))
        this.audio.playSound('rock-hit', {
          playbackRate: nativeEarthBoulderRockHitPitch(effect.charge),
          volume: volume * effect.charge,
        })
        const stoneBreakPitch = nativeEarthBoulderStoneBreakPitch(effect.charge)
        this.audio.playSound('stone-break', { playbackRate: stoneBreakPitch, volume })
      }
      const previousWeldPersistentActors = new Map(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'weld-persistent')
        .map((effect) => [`${effect.worldKey}\u0000${effect.id}`, effect]))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'weld-persistent'
          || effect.buildId !== 1008
          || effect.phase !== 'flight'
          || effect.worldKey !== listenerWorldKey
          || previousWeldPersistentActors.get(
            `${effect.worldKey}\u0000${effect.id}`,
          )?.phase === 'flight'
        ) continue
        this.audio.playSound('ice-start', { playbackRate: 1.5, volume: 1 })
        this.audio.playSound('rock-hit', { playbackRate: 1.5, volume: 1 })
        this.audio.playSound('hail-shot', { playbackRate: 1, volume: 1 })
      }
      const previousGoodImps = new Map(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'fire-good-imp')
        .map((effect) => [`${effect.worldKey}\u0000${effect.id}`, effect]))
      for (const effect of snapshot.primarySpells.transients) {
        if (effect.kind !== 'fire-good-imp' || effect.worldKey !== listenerWorldKey) continue
        const previous = previousGoodImps.get(`${effect.worldKey}\u0000${effect.id}`)
        const priorBounceSequence = previous?.bounceSoundSequence ?? 0
        for (
          let sequence = priorBounceSequence;
          sequence < effect.bounceSoundSequence;
          sequence += 1
        ) {
          this.audio.playSound(GOOD_IMP_BOUNCE_CUES[effect.bounceSoundIndex]!, {
            playbackRate: effect.bounceSoundPitch,
            volume: hubAudioAttenuation(Math.hypot(
              effect.position.x - listener.position.x,
              effect.position.y - listener.position.y,
            )),
          })
        }
        const priorContactSequence = previous?.contactSoundSequence ?? 0
        const contactOrigin = effect.contactOrigin ?? effect.position
        for (
          let sequence = priorContactSequence;
          sequence < effect.contactSoundSequence;
          sequence += 1
        ) {
          this.audio.playSound(GOOD_IMP_CONTACT_CUES[effect.contactSoundIndex]!, {
            playbackRate: effect.contactSoundPitch,
            volume: hubAudioAttenuation(Math.hypot(
              contactOrigin.x - listener.position.x,
              contactOrigin.y - listener.position.y,
            )),
          })
        }
      }
      for (const request of newNativeAirWaterActorSoundRequests(
        this.previous.primarySpells.transients,
        snapshot.primarySpells.transients,
        listener.position,
        listenerWorldKey,
      )) {
        this.audio.playSound(request.cue, {
          playbackRate: request.playbackRate,
          volume: request.volume,
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
      const previousMindblastBursts = new Set(this.previous.secondaryAbilities.actors
        .filter(({ kind }) => kind === 'mindblast-burst')
        .map(({ id, worldKey }) => `${worldKey}\u0000${id}`))
      for (const actor of snapshot.secondaryAbilities.actors) {
        if (
          actor.kind !== 'mindblast-burst'
          || actor.worldKey !== listenerWorldKey
          || previousMindblastBursts.has(`${actor.worldKey}\u0000${actor.id}`)
        ) continue
        const volume = hubAudioAttenuation(Math.hypot(
          actor.position.x - listener.position.x,
          actor.position.y - listener.position.y,
        ))
        this.audio.playSound('magic-shield-explode', { playbackRate: 1, volume })
        this.audio.playSound('big-fire', { playbackRate: 1, volume })
        this.audio.playSound('big-fire', { playbackRate: 0.8, volume })
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
      const previousStaffContacts = new Set(this.previous.primarySpells.transients
        .filter((effect) => effect.kind === 'player-staff-contact')
        .map((effect) => `${effect.worldKey}\u0000${effect.id}`))
      for (const effect of snapshot.primarySpells.transients) {
        if (
          effect.kind !== 'player-staff-contact'
          || effect.worldKey !== listenerWorldKey
          || previousStaffContacts.has(`${effect.worldKey}\u0000${effect.id}`)
        ) continue
        const volume = hubAudioAttenuation(Math.hypot(
          effect.origin.x - listener.position.x,
          effect.origin.y - listener.position.y,
        ))
        this.audio.playSound('staff-swoosh', {
          playbackRate: effect.swooshPitch,
          volume,
        })
        const pikeBreakIndexes = new Set(effect.pikeBreakSoundIndexes)
        for (let index = 0; index < effect.impactSoundPitches.length; index += 1) {
          this.audio.playSound('staff-hit-wood', {
            playbackRate: effect.impactSoundPitches[index],
            volume,
          })
          if (pikeBreakIndexes.has(index)) {
            this.audio.playStream('pike-break', { playbackRate: 1, volume })
          }
        }
        if (effect.procSound === null) continue
        for (const playbackRate of effect.procSoundPitches) {
          this.audio.playSound(effect.procSound, { playbackRate, volume })
        }
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
    const desired = new Map<GameLoopCue, Map<string, PrimaryLoopMix>>(
      LOOP_CUES.map((cue) => [cue, new Map<string, PrimaryLoopMix>()]),
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
        const activeWeldBuildId = player.progression.selectedPrimarySkillId === 52
          ? nativeWeldBuildId(player.progression.weldBuildId)
          : null
        if (activeWeldBuildId !== null) {
          for (const cue of nativeWeldLoopCues(activeWeldBuildId)) {
            desired.get(cue)!.set(owner, {
              playbackRate: activeWeldBuildId === 1007 && player.primaryCast.underpowered
                ? 0.75
                : 1,
              volume: attenuation,
            })
          }
          continue
        }
        switch (selectedPrimaryElement(
          player.progression.selectedPrimarySkillId,
          player.config.element,
        )) {
          case 'air':
            desired.get('lightning-loop')!.set(owner, {
              playbackRate: 1,
              volume: attenuation * (player.primaryCast.underpowered ? 0.75 : 1),
            })
            break
          case 'earth': {
            const gathering = snapshot.primarySpells.projectiles.some((spell) => (
              spell.kind === 'earth'
              && spell.ownerId === playerId
              && spell.phase === 'held'
              && spell.charge < 1
              && spell.worldKey === listenerWorldKey
            ))
            if (gathering) desired.get('gather-rocks-loop')!.set(owner, {
              playbackRate: 1,
              volume: attenuation,
            })
            break
          }
          case 'water':
            desired.get('ice-loop')!.set(owner, {
              playbackRate: 1,
              volume: attenuation * (player.primaryCast.underpowered ? 0.5 : 1),
            })
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
          desired.get('rolling-stone-loop')!.set(`primary-spell:${spell.id}`, {
            playbackRate: 1,
            volume: hubAudioAttenuation(Math.hypot(
              spell.position.x - listener.position.x,
              spell.position.y - listener.position.y,
            )),
          })
        }
      }
      const listener = snapshot.players[this.localPlayerId]
      if (listener) {
        const requestSecondaryLoop = (
          cue: GameLoopCue,
          _ownerId: string,
          position: Readonly<{ x: number; y: number }>,
          gain = 1,
        ) => {
          const volume = gain * hubAudioAttenuation(Math.hypot(
            position.x - listener.position.x,
            position.y - listener.position.y,
          ))
          const owner = `native-ambient:${cue}`
          const loops = desired.get(cue)!
          loops.set(owner, {
            playbackRate: 1,
            volume: Math.max(loops.get(owner)?.volume ?? 0, volume),
          })
        }
        for (const actor of snapshot.primarySpells.transients) {
          if (
            actor.kind !== 'air-hurricane'
            || actor.worldKey !== listenerWorldKey
            || actor.contactCharge <= 0
          ) continue
          requestSecondaryLoop(
            'steady-wind-loop',
            actor.ownerId,
            actor.position,
            actor.contactCharge,
          )
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
              if (actor.phase > 0) {
                requestSecondaryLoop(
                  'rainfall-loop',
                  actor.ownerId,
                  actor.position,
                  actor.phase,
                )
              }
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
      for (const [owner, mix] of next) {
        const prior = current.get(owner)
        if (prior?.playbackRate === mix.playbackRate && prior.volume === mix.volume) continue
        this.audio.startLoop(cue, owner, mix)
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

function nativeWeldBuildId(value: number | null): NativeWeldBuildId | null {
  return Number.isInteger(value) && value !== null && value >= 1000 && value <= 1009
    ? value as NativeWeldBuildId
    : null
}

function selectedPrimaryElement(
  skillId: number,
  fallback: 'air' | 'earth' | 'ether' | 'fire' | 'water',
): typeof fallback {
  if (skillId === 8) return 'ether'
  if (skillId === 16) return 'fire'
  if (skillId === 24) return 'air'
  if (skillId === 32) return 'water'
  if (skillId === 40) return 'earth'
  return fallback
}

function isWeldOneShot(buildId: NativeWeldBuildId): boolean {
  return buildId === 1000 || buildId === 1001 || buildId === 1002 || buildId === 1009
}
