const HUB_ACTOR_DEPTH_BASE = 1000

// College[2] reaches y=320 and is the final stock foreground pass for the
// covered passage left of the spawn landing. Actors sort against that same
// painter boundary, so they emerge without route-specific visibility rules.
export const HUB_SPAWN_ROOF_DEPTH = HUB_ACTOR_DEPTH_BASE + 320

// College[32] is registered at (+10,+60) and its opaque feet reach y=699.
// The full Useful Thyngs kit sorts as one native painter rooted at y=700.
export const HUB_USEFUL_THYNGS_ROOT_Y = 700
export const HUB_USEFUL_THYNGS_DEPTH = HUB_ACTOR_DEPTH_BASE + HUB_USEFUL_THYNGS_ROOT_Y
export const HUB_USEFUL_THYNGS_SHADOW_DEPTH = HUB_ACTOR_DEPTH_BASE - 100

export function hubActorDepth(y: number): number {
  return HUB_ACTOR_DEPTH_BASE + Math.round(y)
}
