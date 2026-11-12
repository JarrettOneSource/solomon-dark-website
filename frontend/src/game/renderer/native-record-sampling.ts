import { generateTextureBatchBitGl, textureBitGl } from 'pixi.js'

export const NATIVE_RECORD_SAMPLE_GLSL = `
  highp vec2 nativeRecordSampleUv(highp vec2 uv, highp vec4 bounds) {
    return bounds.z < bounds.x ? uv : clamp(uv, bounds.xy, bounds.zw);
  }
`

const batchBits = new Map<number, ReturnType<typeof generateTextureBatchBitGl>>()

/** Batched records share their page sampler without sharing a filtering footprint. */
export function nativeRecordTextureBatchBitGl(maxTextures: number) {
  const cached = batchBits.get(maxTextures)
  if (cached) return cached
  const texture = generateTextureBatchBitGl(maxTextures)
  const vertex = texture.vertex!
  const fragment = texture.fragment!
  const bit = {
    ...texture,
    vertex: {
      ...vertex,
      header: `${vertex.header}
        in vec4 aNativeRecordBounds;
        out highp vec4 vNativeRecordBounds;
      `,
      main: `${vertex.main}
        vNativeRecordBounds = aNativeRecordBounds;
      `,
    },
    fragment: {
      ...fragment,
      header: `${fragment.header}
        in highp vec4 vNativeRecordBounds;
        ${NATIVE_RECORD_SAMPLE_GLSL}
      `,
      main: fragment.main!.replace(/\bvUV\b/g, 'nativeRecordSampleUv(vUV, vNativeRecordBounds)'),
    },
  }
  batchBits.set(maxTextures, bit)
  return bit
}

export const NATIVE_RECORD_TEXTURE_BIT_GL = {
  ...textureBitGl,
  fragment: {
    header: `${textureBitGl.fragment.header}
      uniform highp vec4 uNativeRecordBounds;
      ${NATIVE_RECORD_SAMPLE_GLSL}
    `,
    main: 'outColor = texture(uTexture, nativeRecordSampleUv(vUV, uNativeRecordBounds));',
  },
}
