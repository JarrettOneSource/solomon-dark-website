const PROCESSOR_NAME = 'solomon-native-sound-voice-pool'

class SolomonNativeSoundVoicePoolProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffers = []
    this.destroyed = false
    this.voices = []
    this.port.onmessage = ({ data }) => this.receive(data)
  }

  receive(message) {
    if (message?.type === 'register-buffer') {
      this.buffers[message.bufferId] = {
        channels: message.channels,
        sampleRate: message.sampleRate,
      }
      this.voices[message.bufferId] = []
      return
    }
    if (message?.type === 'play') {
      const buffer = this.buffers[message.bufferId]
      const slots = this.voices[message.bufferId]
      if (!buffer || !slots) return
      slots[message.slot] = {
        generation: message.generation,
        playbackRate: message.playbackRate,
        position: 0,
        step: buffer.sampleRate / sampleRate * message.playbackRate,
        volume: message.volume,
      }
      return
    }
    if (message?.type === 'destroy') {
      this.buffers = []
      this.destroyed = true
      this.voices = []
    }
  }

  process(_inputs, outputs) {
    if (this.destroyed) return false
    const output = outputs[0]
    for (const channel of output) channel.fill(0)
    for (let bufferId = 1; bufferId < this.voices.length; bufferId += 1) {
      const buffer = this.buffers[bufferId]
      const slots = this.voices[bufferId]
      if (!buffer || !slots) continue
      const length = buffer.channels[0]?.length ?? 0
      for (let slot = 0; slot < slots.length; slot += 1) {
        const voice = slots[slot]
        if (!voice) continue
        let position = voice.position
        for (let frame = 0; frame < output[0].length; frame += 1) {
          if (position >= length) break
          const index = Math.floor(position)
          const nextIndex = Math.min(index + 1, length - 1)
          const blend = position - index
          for (let channel = 0; channel < output.length; channel += 1) {
            const samples = buffer.channels[Math.min(channel, buffer.channels.length - 1)]
            const sample = samples[index] + (samples[nextIndex] - samples[index]) * blend
            output[channel][frame] += sample * voice.volume
          }
          position += voice.step
        }
        if (position >= length) {
          slots[slot] = null
          this.port.postMessage({
            bufferId,
            generation: voice.generation,
            slot,
            type: 'voice-ended',
          })
        } else {
          voice.position = position
        }
      }
    }
    return true
  }
}

registerProcessor(PROCESSOR_NAME, SolomonNativeSoundVoicePoolProcessor)
