export interface MediaElementGain {
  connect(): void
  disconnect(): void
  volume: number
}

export function createMediaElementGain(
  context: AudioContext,
  media: HTMLMediaElement,
): MediaElementGain {
  const source = context.createMediaElementSource(media)
  const gain = context.createGain()
  let connected = false

  const connect = () => {
    if (connected) return
    source.connect(gain)
    gain.connect(context.destination)
    connected = true
  }
  const disconnect = () => {
    if (!connected) return
    source.disconnect()
    gain.disconnect()
    connected = false
  }

  connect()
  return {
    connect,
    disconnect,
    get volume() {
      return gain.gain.value
    },
    set volume(value: number) {
      connect()
      gain.gain.value = Math.max(0, Math.min(1, value))
    },
  }
}
