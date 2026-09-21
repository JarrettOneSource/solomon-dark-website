# Client input and mod-UI performance boundary — September 21, 2026

## Evidence and claim boundary

The source performance evidence is
`docs/performance-windows-diagnosis-20260921.md`, from Fleet session
`6a583nbx`, run `d3fe51d75225332684c8becc81e91116`. In its saved Windows CPU
profile interval, the separate menu animation callback accounted for 7.43% of
the sampled interval, native `getGamepads()` inside that callback accounted for
6.68%, and the mod quickbar's `removeEventListener` call accounted for 2.35%.
Those are inclusive sampling shares, not additive savings or a prediction of
the result of these changes. This work does not add a timing claim; the parent
worker owns post-change measurement.

Source inspection confirms the two unnecessary-work paths:

- `input/gamepad-menu-navigation.ts` reads `getGamepads()` before resolving
  whether an enabled navigation scope exists. `MainMenuScene` deliberately has
  no menu scope during ordinary Hub/Boneyard play, while `HubScene` and
  `BoneyardScene` already sample gamepad state through
  `createBrowserGameplayInput()` on their presentation loop.
- `mod-ui/ModSkillQuickbar.tsx` creates a new `keydown` closure and installs and
  removes it after every render. The effect also installs the listener when the
  derived mod quickbar is empty and the component renders no DOM.

## System boundary and membership

### Shared gamepad sampling ownership

The bounded system is browser gamepad sampling for gameplay and menu
navigation. Its complete membership for this change is:

| Member | Disposition |
| --- | --- |
| Browser `navigator.getGamepads()` source | `exact-ported`: one shared source retains a current sample and notifies observers synchronously. |
| Gameplay sampling in `input/gameplay-input.ts` | `exact-ported`: gameplay owns each native sample while no menu owns sampling, including while gameplay actions are blocked so neutral/reconnect state does not develop a gap. |
| Menu sampling in `input/gamepad-menu-navigation.ts` | `exact-ported`: an active menu owns each sample; an inactive gameplay menu consumes the gameplay owner's observed state without a second native read, falling back to its own read only when gameplay has not published since the preceding navigation frame. |
| Disabled navigation barriers | `exact-ported`: the menu continues owning samples while its `enabled` gate is false, preserving state across loading/fade barriers even if no gameplay owner exists. |
| Active-scope open, close, and replacement | `exact-ported`: each scope comparison still uses the preceding observed state and the current owner sample, so a held control requires neutral while a fresh edge remains actionable. |
| Repeat clock | `verified-already-at-parity`: the 320 ms initial delay, 110 ms repeat interval, and injectable `now` clock are unchanged. |
| Connection, disconnection, and no-pad samples | `exact-ported`: empty/disconnected/current arrays pass through the same observer path without poll throttling or a timer cache. |
| Injected `getGamepads`, frame scheduler, and clock APIs | `exact-ported`: an injected gamepad source remains self-owned and is sampled on every navigation update as before; frame and wall-clock injection remain unchanged. |
| Keyboard, mouse, and touch input | `out-of-system`: their event ownership and state machines are not changed. |
| Standard-gamepad mapping and gameplay selection | `verified-already-at-parity`: they consume the shared array but retain their existing mapping, neutralization, selection, and action rules. |

The ownership rule is deliberately semantic, not time based:

1. With an active menu scope (or a disabled navigation barrier), menu
   navigation polls and publishes the current browser sample. Gameplay reuses
   that published sample and does not call the native source.
2. With no active menu scope during Hub/Boneyard play, gameplay polls and
   publishes. Menu navigation observes that sample for later scope-transition
   neutralization and does not call the native source when a gameplay sample
   arrived since its preceding frame. If startup, blocking, or a stalled
   presentation loop leaves that interval unsampled, menu navigation performs
   the missing read itself; state observation therefore has no intentional gap.
3. Scope changes transfer ownership; they do not defer or rate-limit a sample.
   Consequently no press/release edge is intentionally discarded by an
   arbitrary polling interval.

The implementation uses `input/gamepad-sampling.ts` as that owner. Its sample
observer is synchronous, so menu state is derived while the browser sample is
current rather than from mutable `Gamepad` references later. The menu tracks
whether any sample was published since its preceding animation callback. This
is why a missing gameplay frame causes one semantic fallback read, while the
normal Hub/Boneyard presentation loop produces no second menu read. Gameplay's
existing injected `getGamepads` option bypasses the shared owner, preserving
the prior deterministic test/embedder contract. `createBrowserMovementInput`
still receives the selected gamepad from `createBrowserGameplayInput`, so it
does not introduce another native read.

### Mod quickbar keyboard lifetime

The bounded system is the Shift+number keyboard binding owned by
`ModSkillQuickbar`:

| Member | Disposition |
| --- | --- |
| Runtime projection subscription | `exact-ported`: the current session is the external-store owner and a session switch synchronously reads the new session snapshot and tears down the old subscription. |
| Derived spell/binding rows | `exact-ported`: each render may derive current rows; they update listener data without becoming listener-lifetime dependencies. |
| Stable `keydown` listener | `exact-ported`: one listener reads the controller's current session and slots. Non-empty runtime updates do not re-register it. |
| Empty quickbar | `exact-ported`: no listener is installed; a non-empty-to-empty transition removes the installed listener once. |
| Session switch | `exact-ported`: an installed listener is removed from the old lifetime and the same stable listener is installed for a non-empty new lifetime. |
| Unmount | `exact-ported`: the installed listener is removed once; repeated cleanup is inert. |
| Shift, modifier, and repeat admission | `verified-already-at-parity`: Shift remains required; Ctrl, Alt, Meta, and repeat remain rejected. |
| Mouse button casting and quickbar rendering | `verified-already-at-parity`: both continue using the same current spell and session cast path. |

`GameClientSession` assigns its new mod runtime projection before notifying
`onModRuntime` subscribers. `useSyncExternalStore` therefore reads a stable,
current projection and gives session identity—not a freshly derived slots
array—ownership of subscription teardown. The keyboard controller stores the
latest derived slots and session separately from its one stable DOM callback;
only empty/non-empty, session, and unmount lifetime transitions touch the DOM
listener.

## Regression contracts and parent-run commands

The focused tests cover shared ownership/poll counts, inactive-to-active scope
handoff, held-button neutralization, no-pad/disconnect samples, unchanged
repeat helpers, stable quickbar handler identity, empty/non-empty runtime
updates, live binding replacement, modifier/repeat rejection, session teardown,
and unmount cleanup.

The implementation worker does not run tests, builds, lint, benchmarks, or
browser validation. The parent worker should run, sequentially on the Mac:

```sh
cd frontend
node --experimental-strip-types --test \
  src/game/input/gamepad-menu-navigation.test.ts \
  src/game/input/gameplay-input.test.ts \
  src/game/mod-ui/mod-skill-quickbar-keyboard.test.ts
node tools/check-mod-quickbar-browser.mjs \
  /tmp/mod-skill-quickbar-browser-receipt.json
cd ..
./scripts/validate.sh
```

The parent integration owner has registered
`src/game/mod-ui/mod-skill-quickbar-keyboard.test.ts` in
`frontend/tsconfig.test.json` and the explicit `test:web-lua` Node test list.
The parent also supplied `tools/check-mod-quickbar-browser.mjs`, which mounts
the real React component in headed Mac Chrome and checks empty/non-empty
updates, binding freshness, modifiers, session replacement, subscription
teardown, and unmount. Those are shared integration/validation files and were
not edited by this worker. The receipt path above is intentionally temporary;
the parent owns execution and durable evidence selection.

## Validation and measurement status

This worker performed source inspection only, as assigned. No test, type
check, lint, build, browser run, benchmark, or performance capture was run.
The implementation makes no post-change CPU or frame-rate claim. The default
browser path is optimized; an explicitly injected menu `getGamepads` source
continues polling once per scheduled navigation update by design so existing
test clocks and embedder semantics do not change.
