# 2026-08-28: College walker prediction parity and presented facing hysteresis

## Reported smell and parity question

- The launch capture of the College intro on production build `daa6707a`
  shows the pre-Create wizard flipping its facing for single frames at the
  Courtyard door trigger (take 12.17 s and 12.20 s, 180 degree flips), across
  the Office entrance (13.2 s to 13.7 s, 90 degree flips under the incoming
  fade) and while closing on the Archchancellor's desk (17.3 s to 18.0 s).
- The authoritative heading never flips: `hub-regions.test.ts` already proves
  that every forced College movement tick faces its own travel, so the parity
  question is whether the flicker is an authoritative facing error (which
  would contradict the native forced-facing setter `0x00503100`) or a
  presentation artefact of client prediction against the forced walk.
- Falsifiers: an authoritative tick whose heading disagrees with its
  displacement; a rendered frame whose facing disagrees with the presented
  displacement while the prediction is exact; a native frame where the walker
  reverses heading.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Capture frames | run-20 `clip1-intro` screencast (86 to 100 fps) with its `index.json` markers | two single-frame front-view flips at frames 30 and 33 after the door trigger; 90 degree flips during the Office incoming fade; 0.5 s of jitter at the desk | high-visible |
| Authoritative walk | `stepHubWorldTick` plan selection and post-move stepping, `core-server/hub-world.ts` | holds until the ready report, follows the Courtyard path at speed 1, switches to the door target at 0.45 on portal contact, walks the Office path at the decaying Office speed through the incoming fade, is blocked by the desk collider for five ticks in the offline replay, then holds on dialogue; every moving tick faces its travel | high |
| Previous client prediction | `client/hub-prediction.ts` before this entry | predicted the path at speed 1 through the door trigger, predicted the incoming target at 0.45 while the server walked the Office path at 1, kept a stale `officeSpeed` and `pathCursor` for up to five ticks, ignored the desk collider and carried input velocity into the dialogue hold | high |
| Presented facing | `HubPlayerView.update` since the 2026-08-27 entry | facing derived from each frame's displacement of the presented position; the 50 ms reconciliation correction moves the sprite backwards on frames that carry no predicted tick whenever the prediction ran ahead, so a positive correction painted a reversed facing for one frame | high |
| Native reference | forced-facing setter `0x00503100`, Courtyard `0x00503E29..0x00503E64`, Office `0x00504917..0x0050493E` | the native walker owns one position and one heading per frame; there is no prediction seam to reconcile, so the native heading never reverses | high |

## Root cause

Two client-only defects; the authoritative walk is unchanged.

1. The client prediction reimplemented a subset of the server's plan selection
   and never stepped the participant (portal contact, the incoming teleport,
   the path cursor and Office speed, the contact counter). Whenever the
   server's plan changed between two snapshots the client ran ahead, and the
   reconciliation correction then dragged the presented sprite backwards over
   the following 50 ms.
2. The presented facing sampled every frame's displacement, including those
   backward correction frames, and flipped with them.

## Changes

- New `core-kernels/hub-participant-movement.ts` owns the scripted plan
  selection (`planHubParticipantMovement`), the post-move participant step
  (`stepHubParticipantMovement`, `stepHubParticipantTransition`), the fixed
  actor layout, the Office polisher body and `nativeCollegeArchContactEligible`.
  `core-server/hub-world.ts` calls it and re-exports the layout.
- `client/hub-prediction.ts` drives the same kernel, resolves scripted
  movement against the region's fixed actors (plus the polisher while the
  admission is pending) through `resolveActorMotion`, so the desk block
  reproduces, and returns the stepped participant. `game-client-session.ts`
  advances `predictedParticipant` tick by tick and passes
  `collegeIntroPending` and `collegeIntroWaiting`; the latter is
  `hubCollegeIntroUnstarted` (the intro exists but no authoritative tick has
  advanced the title cursor), which mirrors the host's ready gate without a
  client-side flag. The only tick the client trails is the one on which the
  ready report lands, and the next snapshot catches it up forwards.
- `core-kernels/actor-heading.ts` adds the movement-facing anchor.
  `advanceActorMovementFacing` turns only after
  `ACTOR_MOVEMENT_FACING_DISTANCE` (4 units, three to four ticks of travel at
  lane cap) from the last turning point and treats a jump of at least
  `ACTOR_MOVEMENT_FACING_TELEPORT_DISTANCE` (64) as a placement that keeps the
  facing. `HubPlayerView.resolveHeadingIndex` uses it while `movementFacing`
  is set and falls back to the replicated heading until the first turn.
- Validation: `client/hub-prediction.test.ts` steps the prediction against
  `stepHubWorldTick` tick for tick through the held reveal, the Courtyard walk,
  the door, the incoming fade, the Office walk, the desk block and the dialogue
  hold, requiring the player and participant to be deep-equal on every tick
  after the ready report; `core-kernels/actor-heading.test.ts` covers the
  ripple, the real turn and the placement; the responsive Tutorial smoke
  replays the anchor rule over the sampled frames and fails any frame that
  turns more than three bins from the previous frame of its region or more
  than one bin from the anchored travel.

## Validation contract

- Every rendered frame of scripted Hub travel faces the direction of the last
  four units of presented travel, and consecutive frames of one region never
  turn by more than 45 degrees.
- Client prediction of a scripted participant equals the authoritative tick
  given the same participant state, except for the single tick on which the
  ready report lands.

## Remaining omissions

- Scripted client movement still ignores Students, other players and the
  Skorcha body. The server bypasses the player and Student pairs for
  onboarding walkers; for an ordinary portal transition they can still nudge
  the walker on the server, which produces at most a small forward or sideways
  correction that the facing anchor absorbs.
- Publication and deployment remain separate receipts; this entry records the
  pre-publication candidate.
