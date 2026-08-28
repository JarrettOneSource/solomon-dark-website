# 2026-08-25 — Empty-run retirement observer-signal suppression

## Reported smell and parity question

- Reported web behavior: the external runtime observer publishes a
  `run.retired_empty` message whenever the last authoritative actor leaves an
  active Boneyard. The user requested that observer message be removed.
- Required behavior: empty private/shared runs must still retire atomically,
  developer observer sockets must still close when their target ends, and the
  structured game-host journal must retain the retirement diagnostic. Only the
  external `RuntimeEvents` outbox signal is excluded.
- Falsifiers: suppressing the notification also preserves an empty run, removes
  the host diagnostic, changes ordinary `run.ended`, or hides player/session
  lifecycle events.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production health | deployed `5b6c915286ffd36c12c94c08f2d295de625eb688`; NFO services and `/health`, 2026-08-25 22:29 EDT | Website and game services are active with `NRestarts=0`; the error journal is empty | high-live |
| Production runtime outbox | `/var/lib/solomon-dark-revived/sdr.db`, `RuntimeEvents.Id=801`, `2026-08-26T02:28:10.495Z` | exact event `run.retired_empty` and message `An active Boneyard retired after its final authoritative actor left.` were published for shared-Hub run `0e30d6b09081ad7693d0dd6e155c08b4` | high-live |
| Current owner trace | `game-host.ts::recordEmptyRunRetirement` | one helper writes the same event/message to both `logGameServerEvent` and `emitRuntimeEvent`; all private/shared and Tutorial/ordinary retirement branches call it | high |
| Observer transport trace | `game-host.ts::broadcastSnapshot`, `game-observer-session.ts`, `MainMenuScene.tsx` | developer observer socket closure uses reason `observed match ended` and a separate callback; it does not consume the runtime outbox record | high |

No new binary extraction is required. Empty-run authority is already closed in
the preceding native-parity entry; this is a Website-only observability policy.

## System boundary and membership inventory

Native system: authoritative Arena actor/run lifetime, already recovered above.
Website extension boundary: the diagnostic and external-observer consumers of
an empty-run retirement after authoritative teardown.

| Member (class/variant/scene/branch) | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Private Tutorial/ordinary run retirement | existing private empty-run owner | `verified-already-at-parity` | zero humans/capacity/runs and no host error |
| Shared Tutorial/ordinary run retirement | existing shared partition owner | `verified-already-at-parity` | run/party target retire while Hub stays live |
| Host structured diagnostic | `logGameServerEvent('run.retired_empty', ...)` | `verified-already-at-parity` | retained once per retired run |
| External runtime-observer notification | `emitRuntimeEvent('run.retired_empty', ...)` | `out-of-system` (user-requested observability suppression) | absent for every retirement branch |
| Developer match-observer target closure | socket close `observed match ended` | `verified-already-at-parity` | observer remains nonauthoritative and exits when target disappears |
| Normal simulation `run.ended` event | `deriveGameActivityEvents` | `verified-already-at-parity` | terminal run activity remains available |
| Player/party/session lifecycle outbox events | existing emitters | `out-of-system` (different event families) | unchanged focused host/supervisor suites |

## Ownership and implementation consequence

- Empty-run retirement owns simulation, recovery, mod, party, observer-target,
  and private-session teardown. None of those owners depend on the runtime
  outbox publication.
- The structured journal is the operations/debugging consumer and remains the
  durable diagnostic. The `RuntimeEvents` sink is an optional external observer
  surface; this retirement event is noise there.
- Remove only the `emitRuntimeEvent` call from
  `recordEmptyRunRetirement`. Do not rename the event, add filtering elsewhere,
  or alter observer socket copy.

## Validation contract

- Red/green host regression: production-shaped private Tutorial, private
  ordinary Boneyard, and shared-Hub Tutorial retirement must retain one
  `run.retired_empty` server log and publish no event with that name to the
  runtime sink.
- Neighbor controls: ordinary peer-backed recovery, developer observer teardown,
  normal `run.ended`, and complete host/supervisor behavior remain green.
- Complete Windows/WSL Website gate per the user's explicit platform direction.
- Post-deployment receipt: no new `run.retired_empty` rows after a fresh
  retirement trigger, unchanged service invocation/restart count, and healthy
  zero-error runtime. Do not deploy while production is occupied.

## Implementation validation receipt

- Red receipt: the pre-fix Windows/WSL `./scripts/validate.sh` run exited `1`;
  its Boneyard suite passed `1567/1570`, with only the private Tutorial,
  private ordinary Boneyard, and shared-Hub Tutorial retirement assertions
  failing because `run.retired_empty` still reached the runtime sink.
- Implementation: `game-host.ts::recordEmptyRunRetirement` no longer calls
  `emitRuntimeEvent`; its structured `logGameServerEvent` call and both
  authoritative retirement callers are unchanged.
- Green receipt: the post-fix Windows/WSL `./scripts/validate.sh` run exited
  `0`, including all three new host assertions, developer-observer controls,
  ordinary run-edge controls, desktop tests, production build, bundle budget,
  and production media policy.
- Publication and production acceptance remain separate: publish only from a
  freshly rebased exact-tree commit while the live game is unoccupied, then
  prove a fresh retirement remains in the journal but not `RuntimeEvents`.
