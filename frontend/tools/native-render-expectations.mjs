// Independent native interpolation and blending expectations for GPU probes.
export function expectedPixel(sample) {
  if (sample.role === 'textured-capture') {
    // This explicit pre-material draw preserves texture RGB even while the
    // surrounding body capture selects diffuse-only color.
    const texture = sample.rgba.slice(0, 3).map(channel => channel / (sample.premultiplied ? sample.rgba[3] : 255))
    const vertex = [128 / 255, 192 / 255, 1]
    const alpha = sample.rgba[3] / 255 * 128 / 255
    return [...texture.map((channel, index) => channel * vertex[index] * alpha * 255), alpha * alpha * 255]
  }
  if (sample.role === 'drawable-color-mode') {
    const texture = sample.diffuse ? [1, 1, 1] : sample.rgba.slice(0, 3).map(channel => (
      channel / (sample.premultiplied ? sample.rgba[3] : 255)
    ))
    const alpha = sample.rgba[3] / 255 * 128 / 255
    const grey = (texture[0] + texture[1] + texture[2]) / 3 * (165 / 255) / 3
    const color = texture.map((channel, index) => {
      const real = index === 0 ? channel * 165 / 255 : 0
      return sample.mode === 'fixed' ? real : grey * .35 + real * .65
    })
    const destination = sample.blend === 'add' ? 1 : 1 - alpha
    return [...color.map((channel, index) => (channel * alpha + [.2, .1, .3][index] * destination) * 255),
      (alpha * alpha + destination) * 255].map(value => Math.min(255, value))
  }
  if (sample.role === 'explicit-shader') return [63, 63, 63, 255]
  if (sample.role === 'retained-color-mode') {
    const color = sample.masked ? [1, 1, 1] : saturate(sample.rgba.slice(0, 3).map(channel => channel / 255), sample.mode)
    const alpha = sample.rgba[3] / 255
    return [...color.map(channel => channel * alpha * 255), alpha * alpha * 255]
  }
  if (sample.role === 'texture-opacity') {
    const alpha = sample.rgba[3] / 255 * (128 / 255) ** 2
    const texture = sample.rgba.slice(0, 3).map(channel => sample.premultiplied ? channel / sample.rgba[3] : channel / 255)
    const vertex = [128 / 255, 192 / 255, 1]
    const grey = (texture[0] + texture[1] + texture[2]) / 3 * (vertex[0] + vertex[1] + vertex[2]) / 3
    const color = texture.map((channel, index) => (
      sample.mode === 'fixed' ? channel * vertex[index] : grey * 0.35 + channel * vertex[index] * 0.65
    ))
    return [...color.map(channel => channel * alpha * 255), alpha * alpha * 255]
  }

  if (sample.role === 'particle-blend') {
    const color = saturate([128 / 255, 64 / 255, 192 / 255], 'arena')
    return sample.blend === 'multiply'
      ? [...color.map(channel => channel * 255), sample.alpha]
      : [...color.map(channel => channel * sample.alpha), sample.alpha * sample.alpha / 255]
  }
  if (sample.role === 'first-normal') return [128, 128, 128, 128 * 128 / 255]
  if (sample.role === 'uniform') {
    const alpha = (128 / 255) ** 2
    const color = saturate([128 / 255, 192 / 255, 1], sample.mode)
    return [...color.map(channel => channel * alpha * 255), alpha * alpha * 255]
  }
  if (sample.role === 'multiply') {
    return [...saturate([128 / 255, 64 / 255, 192 / 255], sample.mode).map(channel => channel * 255), sample.alpha]
  }
  const amount = 8.5 / 16
  const vertex = sample.top.map((value, index) => (value * (1 - amount) + sample.bottom[index] * amount) / 255)
  const groupAlpha = sample.groupAlpha ?? 1
  vertex[3] = (Math.trunc(sample.top[3] * groupAlpha) * (1 - amount) + Math.trunc(sample.bottom[3] * groupAlpha) * amount) / 255
  const color = saturate(vertex.slice(0, 3), sample.mode)
  return [...color.map(channel => channel * vertex[3] * 255), vertex[3] * vertex[3] * 255]
}

export function saturate(color, mode) {
  if (mode === 'fixed') return color
  const grey = (color[0] + color[1] + color[2]) / 3
  return color.map(channel => grey * 0.35 + channel * 0.65)
}

