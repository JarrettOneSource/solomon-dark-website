export function installGameAudioSmokeProbe({
  eventsGlobal = '__sdrAudioEvents',
  sourceMatcherGlobal = '__sdrAudioSourceMatches',
  sourcesGlobal = '__sdrAudioPlaySources',
} = {}) {
  const events = []
  const sources = []
  const encodedSources = new WeakMap()
  const decodedSources = new WeakMap()
  const mediaChannels = new WeakMap()
  const nativeFetch = window.fetch
  const nativeDecode = BaseAudioContext.prototype.decodeAudioData
  const nativeCreateBufferSource = BaseAudioContext.prototype.createBufferSource
  const nativeMediaPause = HTMLMediaElement.prototype.pause
  const nativeMediaPlay = HTMLMediaElement.prototype.play
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
      events.push({
        at: performance.now(),
        channelId,
        contextTime: node.context.currentTime,
        loop: node.loop,
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
    const event = {
      at: performance.now(),
      channelId: mediaChannel(this),
      currentTime: this.currentTime,
      loop: this.loop,
      playbackRate: this.playbackRate,
      semanticFootstepTick: semanticFootstepTick(),
      src: this.currentSrc || this.src,
      type: 'play',
      volume: this.volume,
    }
    events.push(event)
    sources.push(event.src)
    const playback = nativeMediaPlay.call(this)
    if (playback && typeof playback.then === 'function') {
      void playback.then(
        () => events.push({ ...event, at: performance.now(), type: 'started' }),
        () => {},
      )
    }
    return playback
  }

  Object.defineProperties(window, {
    [eventsGlobal]: { value: events },
    [sourceMatcherGlobal]: { value: sourceMatches },
    [sourcesGlobal]: { value: sources },
  })
}
