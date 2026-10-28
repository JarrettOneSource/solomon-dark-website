import type { GameAudioPlaybackOptions } from './game-audio-director.ts'

export const NATIVE_SOUND_VOICE_POOL_PROCESSOR = 'solomon-native-sound-voice-pool'

export interface NativeSoundVoicePool {
  destroy(): void
  play(source: string, options: GameAudioPlaybackOptions): boolean
}

interface RetainedNativeSoundGroup {
  readonly active: boolean[]
  readonly bufferId: number
  readonly generations: number[]
  readonly maximumVoices: number
}

interface NativeSoundVoiceEndedMessage {
  readonly bufferId: number
  readonly generation: number
  readonly slot: number
  readonly type: 'voice-ended'
}

export class RetainedNativeSoundVoicePool implements NativeSoundVoicePool {
  private destroyed = false
  private readonly groupsByBufferId = new Map<number, RetainedNativeSoundGroup>()
  private readonly groupsBySource = new Map<string, RetainedNativeSoundGroup>()
  private nextBufferId = 1
  private readonly node: AudioWorkletNode
  private readonly residentBuffers: ReadonlyMap<string, AudioBuffer>

  constructor(
    node: AudioWorkletNode,
    residentBuffers: ReadonlyMap<string, AudioBuffer>,
  ) {
    this.node = node
    this.residentBuffers = residentBuffers
    this.node.port.onmessage = (event) => this.releaseVoice(event.data)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.node.port.onmessage = null
    this.node.port.postMessage({ type: 'destroy' })
    this.node.port.close()
    this.node.disconnect()
    this.groupsByBufferId.clear()
    this.groupsBySource.clear()
  }

  play(source: string, options: GameAudioPlaybackOptions): boolean {
    if (this.destroyed) throw new Error('native sound voice pool is destroyed')
    const maximumVoices = options.maximumVoices
    if (
      typeof maximumVoices !== 'number'
      || !Number.isSafeInteger(maximumVoices)
      || maximumVoices < 1
    ) {
      throw new RangeError('native sound maximum voices must be a positive integer')
    }
    if (!Number.isFinite(options.playbackRate) || options.playbackRate <= 0) {
      throw new RangeError('native sound playback rate must be positive and finite')
    }
    const group = this.group(source, maximumVoices)
    const slot = group.active.indexOf(false)
    if (slot < 0) return false
    group.active[slot] = true
    const generation = group.generations[slot] + 1
    group.generations[slot] = generation
    this.node.port.postMessage({
      bufferId: group.bufferId,
      generation,
      playbackRate: options.playbackRate,
      slot,
      type: 'play',
      volume: options.volume,
    })
    return true
  }

  private group(source: string, maximumVoices: number): RetainedNativeSoundGroup {
    const existing = this.groupsBySource.get(source)
    if (existing) {
      if (existing.maximumVoices !== maximumVoices) {
        throw new Error('native sound changed its native voice limit')
      }
      return existing
    }
    const buffer = this.residentBuffers.get(source)
    if (!buffer) throw new Error(`game audio buffer was not loaded: ${source}`)
    const channels = Array.from(
      { length: buffer.numberOfChannels },
      (_, channel) => buffer.getChannelData(channel).slice(),
    )
    const bufferId = this.nextBufferId
    this.nextBufferId += 1
    const group = {
      active: Array<boolean>(maximumVoices).fill(false),
      bufferId,
      generations: Array<number>(maximumVoices).fill(0),
      maximumVoices,
    }
    this.groupsByBufferId.set(bufferId, group)
    this.groupsBySource.set(source, group)
    this.node.port.postMessage({
      bufferId,
      channels,
      sampleRate: buffer.sampleRate,
      type: 'register-buffer',
    }, channels.map((channel) => channel.buffer as ArrayBuffer))
    return group
  }

  private releaseVoice(value: unknown): void {
    if (!isVoiceEndedMessage(value)) return
    const group = this.groupsByBufferId.get(value.bufferId)
    if (
      !group
      || value.slot < 0
      || value.slot >= group.maximumVoices
      || group.generations[value.slot] !== value.generation
    ) return
    group.active[value.slot] = false
  }
}

export function createBrowserNativeSoundVoicePool(
  context: AudioContext,
  destination: AudioNode,
  residentBuffers: ReadonlyMap<string, AudioBuffer>,
): NativeSoundVoicePool {
  const node = new AudioWorkletNode(context, NATIVE_SOUND_VOICE_POOL_PROCESSOR, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  })
  node.connect(destination)
  return new RetainedNativeSoundVoicePool(node, residentBuffers)
}

function isVoiceEndedMessage(value: unknown): value is NativeSoundVoiceEndedMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<NativeSoundVoiceEndedMessage>
  return message.type === 'voice-ended'
    && Number.isSafeInteger(message.bufferId)
    && Number.isSafeInteger(message.generation)
    && Number.isSafeInteger(message.slot)
}
