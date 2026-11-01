import { nativePlayerHandCast1Pose, type NativePlayerHandCast1 } from '../../core-kernels/native-player-hand-action.ts'
import { GameProtocolError, boolean, boundedInteger, nonnegativeFinite, onlyKeys, record } from './values.ts'

export function playerHandCast1(value: unknown, field: string): NativePlayerHandCast1 | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, ['done', 'firstPose', 'pose', 'progress', 'rate'])
  const firstPose = boundedInteger(source.firstPose, `${field}.firstPose`, 0, 3)
  if (firstPose !== 0 && firstPose !== 3) {
    throw new GameProtocolError(`${field}.firstPose is outside HandCast1`)
  }
  const progress = nonnegativeFinite(source.progress, `${field}.progress`)
  const rate = nonnegativeFinite(source.rate, `${field}.rate`)
  const pose = boundedInteger(source.pose, `${field}.pose`, 0, 3)
  const done = boolean(source.done, `${field}.done`)
  if (pose !== 0 && pose !== 1 && pose !== 2 && pose !== 3) {
    throw new GameProtocolError(`${field}.pose is outside HandCast1`)
  }
  if (Math.fround(progress) !== progress || Math.fround(rate) !== rate
    || done !== (progress >= 4)
    || (progress > 0 && pose !== nativePlayerHandCast1Pose(firstPose, progress))) {
    throw new GameProtocolError(`${field} is inconsistent with HandCast1 progress`)
  }
  return { done, firstPose, pose, progress, rate }
}

export function validatePlayerHandCast1Owner(
  action: NativePlayerHandCast1 | null,
  owner: { readonly actionTick: number; readonly channelActive: boolean; readonly selectedPrimaryId: number },
  field: string,
): void {
  if (action === null) return
  const selectedOneShot = [8, 16, 1000, 1001, 1002, 1009].includes(owner.selectedPrimaryId)
  if (!Number.isFinite(owner.actionTick) || owner.actionTick < 0 || owner.channelActive || !selectedOneShot) {
    throw new GameProtocolError(`${field} is outside a one-shot action`)
  }
}
