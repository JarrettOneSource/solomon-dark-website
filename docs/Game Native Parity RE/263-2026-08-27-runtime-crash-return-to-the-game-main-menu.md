# 2026-08-27 — Runtime-crash return to the game main menu

## Reported smell and parity question

- Reported Website behavior: the failure surface headed **The game could not
  continue** offers diagnostic submission but no way back to the game title.
- Required behavior: that crash surface must expose a `Main menu` action. The
  action restarts `/game` so every failed runtime and startup owner is torn down
  before the title and required assets are constructed again.
- Scope boundary: this is the Website-owned client-failure and support-
  diagnostics surface. Retail Solomon Dark has no browser transport,
  diagnostic upload, or equivalent recovery page. The recovered native
  lifecycle fact remains that leaving gameplay destroys the active `Game`
  owner before title ownership resumes (`Game` destruction `0x005CD3A0` ->
  `0x005BE0B0` + `0x005CBE10`); no new native fact is asserted here.

## Evidence and causal ownership

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Product direction | user request, 2026-08-27 | The crash page named by its exact heading needs a main-menu button. | high |
| Current page owner | Website `b44c9f23`; `Game.tsx` | `fatal` replaces the complete `MainMenuScene`; a same-route page restart reconstructs `Game` and then `MainMenuScene initialScreen="root"` through the ordinary readiness gate. | high |
| Runtime teardown | same base; `game-client-session.ts`, `game-observer-session.ts`, `MainMenuScene.tsx` | A settled client failure marks the session destroyed before `onFatal`; mounting the failure page unmounts the menu owner, and the page restart additionally retires every page-scoped listener, coordinator, and diagnostic owner. | high |
| Failure taxonomy | same base; `game-connection-failure.ts`, `GameRuntimeError.tsx` | Only `client-error` and `asset-load-failed` use **The game could not continue**. Eleven transport/server/authentication codes use **Disconnected from server**. | high |
| Startup boundary | same base; `Game.tsx`, `game-assets.ts` | An asset-load failure leaves `readiness` at `loading`; clearing only `fatal` would expose the loader forever, so this branch must rerun startup through a page reload. | high |

## System boundary and complete membership

System boundary: the `Game` page owns fatal state and the readiness gate;
`GameRuntimeError` owns failure presentation and explicit diagnostic consent;
the failed session owns its own transport teardown. Returning from a crash may
discard a prepared admission but must not mutate saves, submit logs implicitly,
or broaden the disconnected-server surface.

| Member / branch | Disposition | Required proof |
| --- | --- | --- |
| Settled player-session `client-error` | `out-of-system` Website recovery action | failure page appears; session is already destroyed; Main menu restarts `/game` and reaches a fresh title root |
| Settled observer `client-error` | `out-of-system` Website recovery action | observer closes on failure/unmount; the same restart reaches the title root |
| Connection/setup exception classified `client-error` | `out-of-system` Website recovery action | page-scoped prepared admission and failed create/play subscene are discarded by restart |
| Startup `asset-load-failed` | `out-of-system` Website recovery action | Main menu retries `/game` startup instead of clearing into an unfinishable loader |
| `authentication-failed`, `connection-lost`, `connection-timeout`, `invalid-message`, `protocol-mismatch`, `server-error`, `server-full`, `server-rejected`, `server-restart`, `session-ended`, `transport-unavailable` | `verified-already-at-parity` Website disconnect reporting; unchanged | heading remains **Disconnected from server** and does not acquire the crash-only action |
| Deployment restart with a coincident fatal | `verified-already-at-parity` Website deployment lifecycle | `deploymentRestart` continues to own its update surface; crash recovery does not bypass it |
| Failure explanation and optional technical detail | `verified-already-at-parity` | exact content remains visible and accessible |
| Diagnostic submission idle/sending/sent/failed | `verified-already-at-parity` | remains explicit, credential-free, and independent of Main menu; recovery never submits logs |
| Desktop, compact touch, keyboard, and assistive activation | `out-of-system` browser presentation branch | two crash actions wrap with a stable gap; the named native button remains reachable in the scrolling panel |
| Save/profile/checkpoint state | `verified-already-at-parity` | recovery does not replace, retire, or synthesize a save |

No member is blocked by the browser platform. A persistent asset failure may
return to the same honest failure page after the requested retry; the action
cannot fabricate missing required assets. No Mod Loader document changes are
warranted because no reusable native-system fact was recovered.

## Implementation consequence and validation contract

- Add one `Main menu` button only to the crash-heading branch. Its single owner
  restarts the current `/game` page, which covers runtime and startup failures
  without retaining a second partial-reset lifecycle.
- Preserve the diagnostics button, consent copy, technical detail, submission
  state, disconnected heading/membership, deployment-restart precedence, and
  save ownership.
- Pin the direct restart action, crash-only membership, action layout, and
  existing diagnostic independence in a focused contract.
- On the exact Mac candidate, run the canonical Website gate. In Mac Chrome,
  enter a real local authoritative session, inject one malformed inbound frame
  through the captured browser socket to exercise the ordinary `client-error`
  owner, require **The game could not continue**, press `Main menu`, observe a
  new page navigation, and require the title `Play` action with the failure
  surface gone. Capture page, console, and failed-request/response arrays.

## Implementation validation receipt

- `GameRuntimeError` now paints `Main menu` only beside the crash heading; its
  activation restarts the current page. The disconnected heading and all 11
  transport/server/authentication members retain only their existing explicit
  diagnostic action. The action row wraps with a stable `0.75rem` gap.
- `game-runtime-error-presentation.test.ts` adds three contracts for the exact
  crash-only button/restart, the ordinary `MainMenuScene initialScreen="root"`
  reconstruction, and compact action layout. It is registered in the canonical
  diagnostics group, which passed `10/10` in the complete gate.
- The first callback-shaped candidate correctly covered both readiness
  branches but exceeded the production game-entry budget by 40 gzip bytes
  (`134184 / 134144`). The single page-restart owner removed that partial-reset
  lifecycle and passed on the refreshed `origin/main` base
  `6d3a1d7738ee425ee5876e9e1087afddc940ad0d`.
- Local commit `c7f0f9af51b31926817eef35a334109a8ed5d502`
  and clean detached Mac worktree
  `/Users/jarrett/codex-acceptance/crash-main-menu-recovery-20260827-root-r3/Website`
  matched at tree `fa09dac25580ab0916a1b5748f422f5e43f42e90`.
  macOS 26.6.2 arm64 ran the complete supported
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build passed with zero
  warnings/errors; `26/26` Website/backend contracts, formatting, lint with 17
  existing warnings and zero errors, generated checks, every registered
  frontend/runtime/desktop group, production frontend/game-host builds, bundle
  budget, and media policy passed. Production entry `Game-j3_SigJf.js` measured
  `479264` raw / `134133` gzip bytes under `524288 / 134144`.
- Mac Chrome `151.0.7922.174` drove that production bundle through title ->
  Create -> a real authoritative Hub session, dispatched one malformed inbound
  frame through the captured live socket, and rendered exact heading **The game
  could not continue** plus `Main menu`. Activation changed the navigation time
  origin, removed `.game-runtime-error`, and restored exactly one `Main menu
  actions` title root. Page errors, host errors, and failed HTTP responses were
  empty. The one console error was the intentionally induced
  `[game:connection.failed] message is not valid JSON`; the reload aborted only
  the three in-flight `academy`, `combat`, and `death` MP3 requests. No
  unexpected browser failure occurred.
- No save, protocol, host, Mod Loader, or deployment member changed. No member
  is browser-blocked and no material unknown remains. Publication is pending;
  no deployment or production cutover was performed.
