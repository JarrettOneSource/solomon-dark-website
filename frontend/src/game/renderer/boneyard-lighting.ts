import type { Vec2 } from '../../editor/model.ts'
import { nativeSolomonDirtOrigin } from './boneyard-solomon-dirt-presentation.ts'
import { nativeBoneyardLightScalar, nativeBoneyardLightTint } from '../core-kernels/native-boneyard-light-model.ts'
import type { NativeBoneyardLightSamples } from '../core-kernels/native-boneyard-light-model.ts'

export * from '../core-kernels/native-boneyard-light-model.ts'




export interface NativeSolomonSetPieceLighting {
  bodyTint: number
  dirtTint: number
  lanternTint: number
}

export function nativeSolomonSetPieceLighting(
  digPosition: Vec2,
  lanternPosition: Vec2,
  sources: NativeBoneyardLightSamples,
): NativeSolomonSetPieceLighting {
  return {
    bodyTint: 0xffffff,
    dirtTint: nativeBoneyardLightTint(
      nativeBoneyardLightScalar(nativeSolomonDirtOrigin(digPosition), sources),
    ),
    lanternTint: nativeBoneyardLightTint(
      nativeBoneyardLightScalar(lanternPosition, sources),
    ),
  }
}
