import type { NativeSecondarySnapshotState } from '../protocol/game-state.ts'

export function copyNativeSecondaryState(
  source: NativeSecondarySnapshotState,
): NativeSecondarySnapshotState {
  return {
    actors: source.actors.map(copyActor),
    events: source.events.map((event) => ({
      ...event,
      cameraDisplacement: event.cameraDisplacement === null
        ? null
        : { ...event.cameraDisplacement },
      position: { ...event.position },
      screenFlash: event.screenFlash === null ? null : { ...event.screenFlash },
    })),
    nextActorId: source.nextActorId,
    nextEventId: source.nextEventId,
    players: Object.fromEntries(Object.entries(source.players).map(([playerId, player]) => [
      playerId,
      {
        ...player,
        cooldownMaximumTicksBySkill: [...player.cooldownMaximumTicksBySkill],
        cooldownTicksBySkill: [...player.cooldownTicksBySkill],
      },
    ])),
    targetEffects: source.targetEffects.map((effect) => ({
      ...effect,
      electricBurn: effect.electricBurn === null ? null : { ...effect.electricBurn },
      steamed: effect.steamed === null ? null : { ...effect.steamed },
    })),
  }
}

export function interpolateNativeSecondaryState(
  older: NativeSecondarySnapshotState,
  newer: NativeSecondarySnapshotState,
  blend: number,
): NativeSecondarySnapshotState {
  const newerById = new Map(newer.actors.map((actor) => [actor.id, actor]))
  const actors = older.actors.map((actor) => {
    const next = newerById.get(actor.id)
    if (!next || next.kind !== actor.kind) return copyActor(actor)
    const discrete = blend < 1 ? actor : next
    return {
      ...discrete,
      ageTicks: lerp(actor.ageTicks, next.ageTicks, blend),
      alpha: lerp(actor.alpha, next.alpha, blend),
      endpoint: {
        x: lerp(actor.endpoint.x, next.endpoint.x, blend),
        y: lerp(actor.endpoint.y, next.endpoint.y, blend),
      },
      golem: interpolateGolem(actor.golem, next.golem, discrete.golem, blend),
      midpoint: {
        x: lerp(actor.midpoint.x, next.midpoint.x, blend),
        y: lerp(actor.midpoint.y, next.midpoint.y, blend),
      },
      phase: lerp(actor.phase, next.phase, blend),
      position: {
        x: lerp(actor.position.x, next.position.x, blend),
        y: lerp(actor.position.y, next.position.y, blend),
      },
      radius: lerp(actor.radius, next.radius, blend),
      rotationRadians: lerpAngle(actor.rotationRadians, next.rotationRadians, blend),
      scale: lerp(actor.scale, next.scale, blend),
      velocity: {
        x: lerp(actor.velocity.x, next.velocity.x, blend),
        y: lerp(actor.velocity.y, next.velocity.y, blend),
      },
      hitTargetIds: [...discrete.hitTargetIds],
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(actors.map(({ id }) => id))
    for (const actor of newer.actors) {
      if (!knownIds.has(actor.id)) actors.push(copyActor(actor))
    }
  }
  const discrete = blend < 1 ? older : newer
  const copied = copyNativeSecondaryState(discrete)
  return {
    ...copied,
    actors: blend < 1
      ? actors
      : actors.filter(({ id }) => newerById.has(id)),
  }
}

function copyActor(
  actor: NativeSecondarySnapshotState['actors'][number],
): NativeSecondarySnapshotState['actors'][number] {
  return {
    ...actor,
    golem: actor.golem === null ? null : copyGolem(actor.golem),
    endpoint: { ...actor.endpoint },
    hitTargetIds: [...actor.hitTargetIds],
    lightRegistration: actor.lightRegistration === null
      ? null
      : { ...actor.lightRegistration },
    midpoint: { ...actor.midpoint },
    position: { ...actor.position },
    presentationRng: actor.presentationRng === null
      ? null
      : {
          ...actor.presentationRng,
          words: [...actor.presentationRng.words],
        },
    velocity: { ...actor.velocity },
  }
}

function copyGolem(
  golem: NonNullable<NativeSecondarySnapshotState['actors'][number]['golem']>,
): NonNullable<NativeSecondarySnapshotState['actors'][number]['golem']> {
  return {
    ...golem,
    leftConnectorOffset: { ...golem.leftConnectorOffset },
    leftFoot: { ...golem.leftFoot },
    leftFootBob: { ...golem.leftFootBob },
    leftFootNext: { ...golem.leftFootNext },
    leftFootPrevious: { ...golem.leftFootPrevious },
    rightConnectorOffset: { ...golem.rightConnectorOffset },
    rightFoot: { ...golem.rightFoot },
    rightFootBob: { ...golem.rightFootBob },
    rightFootNext: { ...golem.rightFootNext },
    rightFootPrevious: { ...golem.rightFootPrevious },
  }
}

function interpolateGolem(
  first: NativeSecondarySnapshotState['actors'][number]['golem'],
  second: NativeSecondarySnapshotState['actors'][number]['golem'],
  discrete: NativeSecondarySnapshotState['actors'][number]['golem'],
  blend: number,
): NativeSecondarySnapshotState['actors'][number]['golem'] {
  if (first === null || second === null) return discrete === null ? null : copyGolem(discrete)
  const base = discrete === null ? copyGolem(first) : copyGolem(discrete)
  return {
    ...base,
    leftConnectorOffset: lerpVector(first.leftConnectorOffset, second.leftConnectorOffset, blend),
    leftFoot: lerpVector(first.leftFoot, second.leftFoot, blend),
    leftFootBob: lerpVector(first.leftFootBob, second.leftFootBob, blend),
    leftFootNext: lerpVector(first.leftFootNext, second.leftFootNext, blend),
    leftFootPrevious: lerpVector(first.leftFootPrevious, second.leftFootPrevious, blend),
    leftFootProgress: lerp(first.leftFootProgress, second.leftFootProgress, blend),
    leftFootRotationDegrees: lerp(
      first.leftFootRotationDegrees,
      second.leftFootRotationDegrees,
      blend,
    ),
    rightConnectorOffset: lerpVector(first.rightConnectorOffset, second.rightConnectorOffset, blend),
    rightFoot: lerpVector(first.rightFoot, second.rightFoot, blend),
    rightFootBob: lerpVector(first.rightFootBob, second.rightFootBob, blend),
    rightFootNext: lerpVector(first.rightFootNext, second.rightFootNext, blend),
    rightFootPrevious: lerpVector(first.rightFootPrevious, second.rightFootPrevious, blend),
    rightFootProgress: lerp(first.rightFootProgress, second.rightFootProgress, blend),
    rightFootRotationDegrees: lerp(
      first.rightFootRotationDegrees,
      second.rightFootRotationDegrees,
      blend,
    ),
  }
}

function lerpVector(
  first: Readonly<{ x: number; y: number }>,
  second: Readonly<{ x: number; y: number }>,
  blend: number,
): { x: number; y: number } {
  return {
    x: lerp(first.x, second.x, blend),
    y: lerp(first.y, second.y, blend),
  }
}

function lerp(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
}

function lerpAngle(first: number, second: number, blend: number): number {
  const full = Math.PI * 2
  const delta = ((second - first + Math.PI) % full + full) % full - Math.PI
  return first + delta * blend
}
