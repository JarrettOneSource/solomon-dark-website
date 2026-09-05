export function installGameAudioSmokeProbe({
  eventsGlobal = '__sdrAudioEvents',
  masterVolumesGlobal = '__sdrAudioMasterVolumes',
  mediaChannelsGlobal = '__sdrAudioMediaChannels',
  sourceMatcherGlobal = '__sdrAudioSourceMatches',
  sourcesGlobal = '__sdrAudioPlaySources',
} = {}) {
  const events = []
  const sources = []
  const encodedSources = new WeakMap()
  const decodedSources = new WeakMap()
  const bufferMasters = []
  const mediaElements = []
  const gainDestinations = new WeakMap()
  const mediaChannels = new WeakMap()
  const mediaOutputGains = new WeakMap()
  const nativeFetch = window.fetch
  const nativeDecode = BaseAudioContext.prototype.decodeAudioData
  const nativeCreateBufferSource = BaseAudioContext.prototype.createBufferSource
  const nativeCreateGain = BaseAudioContext.prototype.createGain
  const nativeCreateMediaElementSource = AudioContext.prototype.createMediaElementSource
  const nativeMediaPause = HTMLMediaElement.prototype.pause
  const nativeMediaPlay = HTMLMediaElement.prototype.play
  const nativeGetChannelData = AudioBuffer.prototype.getChannelData
  const nativeFloatSlice = Float32Array.prototype.slice
  const nativePostMessage = MessagePort.prototype.postMessage
  const pcmSources = new WeakMap()
  const nativeVoiceSources = new WeakMap()
  let nextChannelId = 1

  const sourceMatches = (actual, expected) => {
    const actualName = new URL(actual, location.href).pathname.split('/').pop()
    const expectedName = expected.split('/').pop()
    const extensionAt = expectedName.lastIndexOf('.')
    const stem = expectedName.slice(0, extensionAt)
    const extension = expectedName.slice(extensionAt)
    const suffix = actualName.slice(stem.length, -extension.length)
    return actualName === expectedName
      || (actualName.startsWith(`${stem}-`)
        && actualName.endsWith(extension)
        && /^-[\w-]+$/.test(suffix))
  }
  const mediaChannel = (media) => {
    const existing = mediaChannels.get(media)
    if (existing !== undefined) return existing
    const channelId = nextChannelId
    nextChannelId += 1
    mediaChannels.set(media, channelId)
    mediaElements.push(media)
    return channelId
  }
  const semanticFootstepTick = () => document.querySelector('.boneyard-scene, .hub-scene')
    ?.getAttribute('data-last-footstep-tick') ?? null

  window.fetch = async function (input, init) {
    const response = await nativeFetch.call(this, input, init)
    const source = input instanceof Request
      ? input.url
      : new URL(String(input), location.href).href
    const nativeArrayBuffer = response.arrayBuffer.bind(response)
    Object.defineProperty(response, 'arrayBuffer', {
      value: async () => {
        const contents = await nativeArrayBuffer()
        encodedSources.set(contents, source)
        return contents
      },
    })
    return response
  }
  BaseAudioContext.prototype.decodeAudioData = function (contents) {
    const source = encodedSources.get(contents)
    const decoded = nativeDecode.call(this, contents)
    if (!source) return decoded
    return decoded.then((buffer) => {
      decodedSources.set(buffer, source)
      return buffer
    })
  }
  BaseAudioContext.prototype.createGain = function () {
    const gain = nativeCreateGain.call(this)
    const nativeConnect = gain.connect.bind(gain)
    gain.connect = function (destination, ...args) {
      gainDestinations.set(gain, destination)
      return nativeConnect(destination, ...args)
    }
    return gain
  }
  AudioBuffer.prototype.getChannelData = function (...args) {
    const channel = nativeGetChannelData.apply(this, args)
    const source = decodedSources.get(this)
    if (source) pcmSources.set(channel, source)
    return channel
  }
  Float32Array.prototype.slice = function (...args) {
    const copy = nativeFloatSlice.apply(this, args)
    const source = pcmSources.get(this)
    if (source) pcmSources.set(copy, source)
    return copy
  }
  MessagePort.prototype.postMessage = function (message, ...args) {
    if (message?.type === 'register-buffer' && message.channels?.[0]) {
      const source = pcmSources.get(message.channels[0])
      if (source) {
        let sourcesById = nativeVoiceSources.get(this)
        if (!sourcesById) {
          sourcesById = new Map()
          nativeVoiceSources.set(this, sourcesById)
        }
        sourcesById.set(message.bufferId, source)
      }
    }
    if (message?.type === 'play') {
      const source = nativeVoiceSources.get(this)?.get(message.bufferId)
      if (source) events.push({
        at: performance.now(),
        channelId: `native:${message.bufferId}:${message.slot}`,
        loop: false,
        playbackRate: message.playbackRate,
        src: source,
        type: 'buffer-start',
        volume: message.volume,
      })
    }
    return nativePostMessage.call(this, message, ...args)
  }
  BaseAudioContext.prototype.createBufferSource = function () {
    const node = nativeCreateBufferSource.call(this)
    const nativeConnect = node.connect.bind(node)
    const nativeStart = node.start.bind(node)
    const nativeStop = node.stop.bind(node)
    const channelId = nextChannelId
    nextChannelId += 1
    let gain = null
    node.connect = function (destination, ...args) {
      if (destination instanceof GainNode) gain = destination
      return nativeConnect(destination, ...args)
    }
    node.start = function (...args) {
      const src = decodedSources.get(node.buffer) ?? ''
      const master = gain ? gainDestinations.get(gain) : null
      if (master instanceof GainNode) bufferMasters.push({ gain: master, src })
      events.push({
        at: performance.now(),
        channelId,
        contextTime: node.context.currentTime,
        loop: node.loop,
        masterVolume: master instanceof GainNode ? master.gain.value : 1,
        playbackRate: node.playbackRate.value,
        semanticFootstepTick: semanticFootstepTick(),
        src,
        type: 'buffer-start',
        volume: gain?.gain.value ?? 1,
      })
      sources.push(src)
      return nativeStart(...args)
    }
    node.stop = function (...args) {
      events.push({
        at: performance.now(),
        channelId,
        src: decodedSources.get(node.buffer) ?? '',
        type: 'buffer-stop',
      })
      return nativeStop(...args)
    }
    return node
  }
  AudioContext.prototype.createMediaElementSource = function (media) {
    const node = nativeCreateMediaElementSource.call(this, media)
    const nativeConnect = node.connect.bind(node)
    node.connect = function (destination, ...args) {
      if (destination instanceof GainNode) mediaOutputGains.set(media, destination)
      return nativeConnect(destination, ...args)
    }
    return node
  }
  HTMLMediaElement.prototype.pause = function () {
    events.push({
      at: performance.now(),
      channelId: mediaChannel(this),
      currentTime: this.currentTime,
      loop: this.loop,
      src: this.currentSrc || this.src,
      type: 'pause',
      volume: this.volume,
    })
    nativeMediaPause.call(this)
  }
  HTMLMediaElement.prototype.play = function () {
    const media = this
    const event = {
      at: performance.now(),
      channelId: mediaChannel(this),
      currentTime: this.currentTime,
      loop: this.loop,
      playbackRate: this.playbackRate,
      semanticFootstepTick: semanticFootstepTick(),
      src: this.currentSrc || this.src,
      type: 'play',
      outputVolume: mediaOutputGains.get(this)?.gain.value ?? this.volume,
      volume: this.volume,
    }
    events.push(event)
    sources.push(event.src)
    const playback = nativeMediaPlay.call(this)
    if (playback && typeof playback.then === 'function') {
      void playback.then(
        () => events.push({
          ...event,
          at: performance.now(),
          src: media.currentSrc || media.src,
          type: 'started',
        }),
        () => {},
      )
    }
    return playback
  }

  Object.defineProperties(window, {
    [eventsGlobal]: { value: events },
    [masterVolumesGlobal]: {
      value: (sourceFragment = '') => [...new Set(bufferMasters
        .filter(({ src }) => src.includes(sourceFragment))
        .map(({ gain }) => gain))]
        .map(({ gain }) => gain.value),
    },
    [mediaChannelsGlobal]: {
      value: () => mediaElements.map((media) => ({
        channelId: mediaChannel(media),
        currentTime: media.currentTime,
        loop: media.loop,
        muted: media.muted,
        outputVolume: mediaOutputGains.get(media)?.gain.value ?? media.volume,
        paused: media.paused,
        src: media.currentSrc || media.src,
        volume: media.volume,
      })),
    },
    [sourceMatcherGlobal]: { value: sourceMatches },
    [sourcesGlobal]: { value: sources },
  })
}
