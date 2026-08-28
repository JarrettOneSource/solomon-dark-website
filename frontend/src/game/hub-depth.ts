const HUB_ACTOR_DEPTH_BASE = 1000

// PotionGuy::Present owns distinct painters: College[34] immediately below
// the actor, College[32] above it, then the balloon bank.
export const HUB_USEFUL_THYNGS_COUNTER_DEPTH = HUB_ACTOR_DEPTH_BASE + 663
export const HUB_USEFUL_THYNGS_FRONT_DEPTH = HUB_ACTOR_DEPTH_BASE + 700
export const HUB_USEFUL_THYNGS_BALLOON_DEPTH = HUB_USEFUL_THYNGS_FRONT_DEPTH + 1
export const HUB_USEFUL_THYNGS_MARKER_DEPTH = HUB_USEFUL_THYNGS_BALLOON_DEPTH + 1
export const HUB_USEFUL_THYNGS_SHADOW_DEPTH = HUB_ACTOR_DEPTH_BASE - 100

// Region+0x278 paints immediately before the shared 0x0068C480 world queue.
export const HUB_PRE_WORLD_ANIMATION_DEPTH = HUB_ACTOR_DEPTH_BASE - 1

// Courtyard::Present submits College[19,30,31,21,22] after every actor, then
// builds the southern battlements and its two registered platform records.
export const HUB_COURTYARD_FOREGROUND_DEPTH = HUB_ACTOR_DEPTH_BASE + 3000
// Region+0x22C paints immediately after the shared world queue and before the
// Courtyard's authored foreground/overhead records.
export const HUB_POST_WORLD_ANIMATION_DEPTH = HUB_COURTYARD_FOREGROUND_DEPTH - 1
export const HUB_SOUTHERN_FOREGROUND_DEPTH = HUB_COURTYARD_FOREGROUND_DEPTH + 1
export const HUB_ASTRONOMER_DEPTH = HUB_SOUTHERN_FOREGROUND_DEPTH + 1
export const HUB_ASTRONOMER_TELESCOPE_DEPTH = HUB_ASTRONOMER_DEPTH + 1
export const HUB_ASTRONOMER_FRONT_DEPTH = HUB_ASTRONOMER_TELESCOPE_DEPTH + 1

export function hubActorDepth(y: number): number {
  return HUB_ACTOR_DEPTH_BASE + Math.round(y)
}
