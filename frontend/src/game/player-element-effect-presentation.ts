import handProgram from '../assets/game/player-bare-hand-program.json' with { type: 'json' }
import { NATIVE_GROUND_PI } from './core-kernels/native-ground-auxiliary.ts'
import type { NativePlayerWeaponKind } from './core-kernels/native-player-weapon.ts'
import type { NativePlayerHandPose } from './core-kernels/native-player-hand-action.ts'
import type { Vector2 } from './core-kernels/vector.ts'

export function playerHandElementEffectPlan(
  headingIndex: number,
  pose: NativePlayerHandPose,
  tick: number,
  effectPhase: number,
  channelActive: boolean,
): { readonly offset: Vector2; readonly scale: number; readonly front: boolean; readonly back: boolean } {
  const frame = handFrame(headingIndex, pose)
  const radians = Math.fround(Math.fround(2 * tick) * NATIVE_GROUND_PI / 180)
  const bob = Math.fround(Math.sin(radians))
  const admitted = pose !== 2 || channelActive
  return {
    offset: { x: frame[0]!, y: Math.fround(frame[1]! + bob) },
    scale: playerElementEffectScale(effectPhase, null),
    front: admitted && frame[2]! <= handProgram.referenceDepth,
    back: admitted && frame[2]! >= handProgram.referenceDepth,
  }
}

export function playerElementEffectScale(effectPhase: number, weaponKind: NativePlayerWeaponKind = 'staff'): number {
  const scale = weaponKind === null ? Math.fround(.8) : weaponKind === 'wand' ? Math.fround(.6) : 1
  return Math.fround(scale * (1 + 10 * effectPhase))
}

export function playerHandElementAngleSocket(headingIndex: number): Vector2 {
  const frame = handFrame(headingIndex, 0)
  return { x: frame[0]!, y: frame[1]! }
}

/** 0053B830 deliberately uses X for both axes in its Wand/bare query. */
export function playerElementEffectCallAngle(socket: Vector2, weaponKind: NativePlayerWeaponKind): number {
  const y = weaponKind === 'staff' ? socket.y : socket.x
  const radians = Math.fround(Math.atan2(socket.x, -(y + (weaponKind === null ? 10 : 20))))
  let degrees = Math.fround(radians * 180 / NATIVE_GROUND_PI)
  if (degrees < 0) degrees = Math.fround(degrees + 360)
  return Math.trunc(degrees)
}

function handFrame(headingIndex: number, pose: NativePlayerHandPose): readonly number[] {
  const heading = ((Math.round(headingIndex) % 24) + 24) % 24
  return handProgram.poses[pose]![heading]!
}
