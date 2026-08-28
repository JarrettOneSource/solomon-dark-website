# 2026-08-15 — Persistent game interaction surface and mobile browser defaults

## Reported smell and parity question

- Reported web behavior: rapidly tapping either mobile joystick can make the
  whole game look selected or highlighted like webpage text. The requested
  outcome is a `/game` route that behaves as one game surface rather than a
  collection of ordinary selectable/draggable browser elements.
- Stock behavior to preserve: the retail window sends pointer and keyboard
  input through the active control tree and draws the result into one
  backbuffer. It has no DOM text selection, image dragging, touch callout,
  browser context menu, or viewport overscroll path competing with controls.
- Reproduction surfaces: startup loader, Title/Play, Create, Hub and all Hub
  UI, match loading, level-up UI, Boneyard and game-over UI, runtime failure,
  both joysticks, normal press/hold/release, rapid taps, long press, mouse,
  keyboard, and scrollable Hub panels.
- Falsifiers: a scene-local selector, joystick-only selection rule, disabled
  Hub panel scrolling, disabled semantic focus/activation, a viewport meta tag
  that forbids accessibility zoom, a leaked context menu/drag, or any change to
  authoritative input state disproves the proposed shell ownership.

This reopens the touch-input/display-shell system covered by the 2026-08-13
joystick review and 2026-08-14 mobile fullscreen/right-stick entries. Those
passes correctly closed pointer lifetime, transform geometry, fullscreen, and
simulation routing, but their membership sweep stopped at the active scene and
individual joystick. They did not enumerate the persistent route shell or the
browser default-action siblings shared by every scene.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native instructions | retail `SolomonDark.exe` 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `GameWindowProc` `0x00443440`, app dispatch `0x0040D900`, control down/up routers `0x0040E050/0x0040E190`, recursive hit test `0x00428620`, fixed game tick `0x005D7EF0` | Win32 ingress buffers edges, capture/topmost active controls own them, and the game consumes device levels. The rendered window is not a document-selection surface. | high |
| Current native report | Mod Loader `origin/main` `380f693a3deea4cf9f7fe3a2f14db0c13fbc47e4`; `docs/reverse-engineering/native-input-model.md` read from that ref | The input census separates Win32 surface routing, held-device sampling, and player simulation. Modal/HUD controls swallow their edge before the arena, while capture retains one pointer owner through release. | high |
| Pre-fix web causal trace | Website `ba0524bb6c914c8889b3d49e727b92d09c9e93f7`; `Shell.tsx`, `Game.tsx`, `main-menu.css`, `hub.css`, `boneyard.css`, `match-loading-screen.css`, and `input/touch-joystick.css` | The persistent `/game` `<main>` has no game interaction policy. `user-select: none` is repeated only on Create, Hub, Boneyard, and match loading. The joystick alone has `touch-action: none`; no route owner blocks native drag/context actions. | high |
| Controlled baseline browser | Chrome `150.0.7871.124`, Linux mobile emulation `844 x 390`, Vite plus local authoritative host, twelve rapid movement-stick taps and one 850 ms hold | The headless run did not reproduce a visible selection and emitted no select/context/drag events, but computed the persistent shell and menu page as `user-select:auto`, `touch-action:auto`, and `overscroll-behavior:auto`. Hub happened to compute selection `none` only through its scene-local rule. The joystick retained focus after the gesture. This does not falsify the physical-device report; it proves the ownership gap. | high for computed policy; low for device-specific visual reproduction |
| CSS UI standard | W3C CSS Basic User Interface Level 4, retrieved 2026-08-15, `https://www.w3.org/TR/css-ui-4/#content-selection` | `user-select:none` exists specifically to avoid accidental selection on interactive UI. The standard also records Chrome/Safari boundary differences when selection starts or ends across a `user-select:none` element, making scattered scene rules weaker than one route boundary. | high |
| Pointer Events standard | W3C Pointer Events, retrieved 2026-08-15, `https://www.w3.org/TR/pointerevents/#the-touch-action-css-property` | `touch-action` controls viewport panning/zooming; it explicitly does not control text selection/highlighting or link/form activation. The existing joystick declaration therefore cannot close the reported selection class. | high |
| Overscroll and WebKit policy | W3C CSS Overscroll Behavior Level 1; Apple Safari CSS Reference for `-webkit-touch-callout` and `-webkit-tap-highlight-color`, retrieved 2026-08-15 | Overscroll policy can stop chaining/navigation affordances at a scroll boundary. iOS exposes separate long-press callout and tap-highlight policies, so neither is implied by `user-select` or `touch-action`. | high |

No new native address, object field, asset, registry row, or runtime fact is
recovered here. The current Mod Loader input report already owns the reusable
stock routing facts, so this browser-adaptation pass must not duplicate or edit
that report.

## System boundary and membership inventory

Native system: **application-owned interactive display surface** — the window
owner above all screens decides whether an input edge belongs to a game
control; browser document defaults are outside that native graph and must be
sealed once at the analogous persistent `/game` shell.

There is no authored data table in this system. The complete membership comes
from the `/game` route tree, every scene/overlay branch beneath it, and the
browser default-action classes that can compete with those members.

| Member (class/variant/scene/branch) | Native/browser source | Disposition required for closure | Proof |
| --- | --- | --- | --- |
| Suspense loader and asset-readiness loader | native loader is application/backbuffer-owned; `NativeLoader` is the two web entry branches | `exact-ported` | shared-shell source contract plus browser loader probe |
| Title root, Play submenu, account label, fullscreen/install control, orientation guidance | native MainMenu and application display owner; persistent `MainMenuScene` siblings | `exact-ported` | shared-shell source contract plus Title browser probe |
| Create element and discipline/loadout stages | native Create control tree | `exact-ported` | shared-shell source contract plus Create browser probe |
| Hub world, HUD, twin joysticks, inventory/trader surfaces, and Boneyard picker | native Region plus modal/HUD first-hit routing; web Hub subtree | `exact-ported` | shell policy, pointer-default assertion, preserved panel-scroll assertion, Hub browser probe |
| Match-loading cover, level-up picker, and waiting barrier | native/web blocking overlays and modal control ownership | `exact-ported` | structural membership contract and live transition probe |
| Boneyard world, HUD, twin joysticks, spectator/dig indicators, game-over surface | native Region, HUD, and Game Over control owners; web Boneyard subtree | `exact-ported` | shared-shell source contract plus Boneyard browser probe |
| Connection/runtime failure and retry/report controls | Website-only route failure branch under the same shell | `exact-ported` | structural membership contract and forced-error browser probe |
| Accidental DOM selection and iOS long-press callout | CSS UI selection model and Apple touch-callout extension | `exact-ported` | computed shell policy, rapid/held touch selection receipt |
| Native image drag and browser context menu | HTML drag/context default actions | `exact-ported` | cancelable event browser assertions at the shared shell |
| Tap highlight | Tailwind preflight plus Chrome computed `rgba(0, 0, 0, 0)` at shell, menu, scene, and joystick | `verified-already-at-parity` | retain an explicit route-owned transparent declaration so a framework reset cannot silently own game behavior |
| Pointer capture, movement/primary levels, simulation, replication, audio, and render state | closed joystick/right-stick/native-input contracts | `verified-already-at-parity` | existing unit and production-joystick receipts; no model or protocol edit |
| Public Website pages and Boneyard editor | separate Shell branches with normal document/tool interactions | `out-of-system` (their text selection, dragging, scrolling, and context menus must remain ordinary browser behavior) | route-scoped class/event ownership only on exact `/game` branch |
| OS-owned edge navigation, Home indicator, notification shade, and browser UI retained outside element/installed fullscreen | protected user-agent/operating-system gestures cannot be canceled reliably by page content | `blocked-by-platform` (browser/OS ownership) | visible difference is limited to platform chrome/system gestures the active browser continues to expose |

## Native ownership thread

- Owner and construction path: native `GameWindowProc` feeds the application
  control roots and capture owner before the fixed game tick. The web analogue
  is the exact `/game` branch in `Shell`, which persists while Loader, Title,
  Create, Hub, Boneyard, overlays, and fatal presentation replace one another.
- Upstream state producers/callers: mouse, pen, keyboard, and touch produce
  DOM events. Browser CSS policy first decides whether a gesture may become
  selection, panning/zooming, overscroll, callout, or tap highlight; accepted
  game input then reaches the existing scene/browser adapter.
- State representation and transitions: the shell policy exists only while
  `location.pathname === '/game'`. It owns no gameplay state. The movement and
  primary joysticks retain their separate pointer ids, vectors, cast level,
  capture, interruption, and teardown rules.
- Downstream consumers/callees: menu buttons, fullscreen, Hub scroll panels,
  HUD controls, world input, and the authoritative session receive the same
  events they already own. Suppressed browser defaults do not become game
  commands.
- Entry, interruption, reset, and teardown: route entry mounts the policy
  before the game subtree. Route exit removes it with the shell; public pages
  regain ordinary document behavior without a global class or listener to
  clean up. Joystick release/cancel/blur/pagehide teardown remains unchanged.

## Recovered behavioral contract

- Selection ownership: the persistent shell declares both standard and WebKit
  selection `none`, closing every auto-valued descendant in one boundary.
  Scene-local declarations become obsolete and must be removed rather than
  retained as competing owners.
- Gesture ownership: the shell uses `touch-action: manipulation`, which removes
  multi-tap viewport gestures while preserving continuous accessibility zoom
  and scrolling. Each joystick keeps `touch-action:none` and additionally
  cancels its own `pointerdown`, because that surface has no browser click,
  focus, scroll, or selection action to preserve.
- Scroll ownership: the shell blocks overscroll/chaining, not local scrolling.
  Hub picker, shop, and inventory `overflow:auto` regions remain vertically
  scrollable because no ancestor declares `touch-action:none`.
- Callout/highlight/drag/menu ownership: the shell explicitly disables iOS
  touch callout and tap highlight. Cancelable context-menu and drag-start
  events are prevented at the shell so images/canvases cannot become browser
  drags and long/right press cannot open browser UI over the game.
- Accessibility and semantic controls: do not add `user-scalable=no` or
  `maximum-scale=1`. Keyboard focus, screen-reader labels, button activation,
  fullscreen trusted activation, and continuous pinch zoom remain available.
- Input/network/render boundary: no game input vector, cast edge, fixed tick,
  snapshot, protocol version, collision, camera, audio, RNG, or painter order
  changes. The correction ends before `createBrowserGameplayInput`.

## Nearby-system findings

- `@import 'tailwindcss'` currently supplies a global transparent WebKit tap
  highlight. That happens to cover `/game`, but it is framework-wide policy;
  the game shell should state its own contract so a reset change cannot revive
  the symptom.
- The web-app manifest already requests `display:fullscreen`, landscape
  orientation, `/game` start URL, and the document already has
  `viewport-fit=cover`. This pass does not add fake fullscreen, a service
  worker, or zoom-disabling viewport metadata.
- Headless Chrome cannot prove the user's physical mobile browser quirk. It can
  prove the computed policy, real event cancellation, selection emptiness under
  repeated contacts, and preserved game behavior. Final Solomon Dark device
  acceptance remains the Mac mini/attached-browser boundary.

## Confidence and open questions

- Confirmed: native/web owner mismatch, complete route membership, scattered
  current selection declarations, absence of shell drag/context policy,
  standards separation between selection and `touch-action`, scrollable Hub
  descendants, and unchanged authoritative input boundary.
- User-observed but not reproduced in Linux Chrome: the exact visual highlight
  and its mobile browser/build. The fix does not depend on guessing which of
  selection, callout, or compatibility focus painted it; it seals every
  browser default in that reported class at their shared owner.
- Platform limit: OS/browser-reserved edge gestures and system chrome remain
  externally owned. A user may still see those affordances outside supported
  element fullscreen or installed app mode.

## Web implementation consequence

- Correct owner/module: add one route-scoped `game-surface` class and default
  event boundary to the exact `/game` `<main>` in `Shell`, with its declarations
  in a component-independent game surface stylesheet loaded by that owner.
- Shared model change: none. This is browser ingress policy above every scene.
- Stock behavior preserved: game controls remain the only content-owned action
  targets, matching the native window/control-tree boundary.
- Browser-specific adaptation: standard/WebKit selection, callout, highlight,
  touch manipulation, overscroll, drag, and context-menu policy. OS gestures
  remain the named platform limit above.
- Obsolete paths to remove: scene-local `user-select:none` declarations in
  Create, Hub, Boneyard, and match loading after the shell owns the rule.

## Validation contract

- Focused automated contract: pin the exact `/game`-only class/event owner,
  complete shell CSS declaration set, joystick `pointerdown` cancellation, and
  removal of scene-local selection ownership. Prove the public Shell branch
  does not receive the class or default-event handlers.
- Production Playwright journey: inspect Loader, Title, Create, Hub, loading,
  Boneyard, and forced runtime-error descendants. At each reachable member the
  shared shell must compute selection `none`, `touch-action:manipulation`,
  overscroll `none`, and transparent tap highlight.
- Mobile input receipt: rapidly tap and hold both joysticks, require every
  joystick pointer down to be canceled, require `Selection.type === 'None'`
  and an empty string, then prove movement, primary cast, concurrent contacts,
  release, and scene replacement still satisfy the existing production smoke.
- Default-action and accessibility receipt: synthetic cancelable context-menu
  and drag-start must be prevented inside `/game`; Hub scroll containers remain
  scrollable; menu/fullscreen buttons and keyboard focus still work; the
  viewport metadata must remain zoom-capable.
- Canonical acceptance: `./scripts/validate.sh`, the focused production browser
  journey with empty page/console errors, and final Mac mini browser acceptance
  on the exact tree.

## Implementation validation receipt

Website base `d318e59eb2c656471a1cb7cb3ca3003d6dd8bb30` now gives the exact
`/game` branch in `Shell.tsx` one persistent `.game-surface` owner. Its
route-scoped stylesheet disables standard/WebKit selection, WebKit callout and
tap highlight, overscroll chaining, and multi-tap viewport gestures while
retaining continuous zoom and descendant scrolling through
`touch-action:manipulation`. The shell cancels context-menu and drag-start
defaults. Each joystick retains its existing `touch-action:none`, pointer
capture, and input lifetime, and now cancels its own pointer-down default. The
four obsolete Create/Hub/Boneyard/loading selection rules were removed; public
Website and editor branches were not changed.

The focused source contract was deliberately run before implementation: the
seven existing fullscreen/install tests passed and all four new game-surface
tests failed. After implementation the same file passed `11/11`. It pins the
single exact-route owner, complete browser-default policy, zoom-capable
viewport, joystick cancellation, and absence of transient scene ownership.
The Hub Boneyard picker retains `overflow:auto`, and the runtime shell computes
`touch-action:manipulation`, so the correction does not turn the entire game
tree into a non-scrollable joystick surface.

On Linux, the first post-rebase canonical run exposed one transient failure in
the concurrently expanded 816-test frontend suite (`815/816`); the unchanged
focused suite then passed `816/816`, and a complete unchanged rerun of
`./scripts/validate.sh` exited zero. That final run passed all 24 backend/route
contracts, lint and architecture checks with only the repository's eight
existing Fast Refresh warnings, all frontend/auxiliary/desktop suites, the
production frontend and game-host builds, and the production media-policy
gate.

The earlier Linux production-browser diagnostic also had one startup run stall
at loader item `1/706` with no page or console error. A fresh browser against
the unchanged host, preview, and bundle passed the complete journey. This is
recorded as an intermittent loader-readiness diagnostic, not final acceptance.

Final acceptance used a detached Mac mini worktree at the same base and exact
implementation, test, smoke, and pre-receipt ledger diff; this final receipt
was written after those results existed. Jarrett's Mac mini was `arm64` macOS
`26.4.1`, Node `22.17.0`, npm `10.9.2`, .NET `10.0.302`, and Google Chrome
`151.0.7922.138`.
`./scripts/validate.sh` exited zero there with the same 24 backend contracts,
`816/816` main frontend tests, auxiliary and desktop suites, production builds,
and media-policy check.

The Mac production browser journey used a real loopback authoritative host and
the built bundle at `844x390`. It proved Loader, Title, Create, Hub loading,
Hub, Boneyard loading, Boneyard, and forced runtime-error membership under the
same shell. Every member computed selection `none`,
`touch-action:manipulation`, overscroll `none`, and a transparent tap
highlight; cancelable context-menu and drag-start events were prevented. Eight
rapid taps on each joystick plus one 850 ms hold yielded 17 canceled
pointer-down defaults, `Selection.type === 'None'`, zero selection ranges or
text, and no focused joystick. Movement, rightward Water heading 6,
simultaneous movement/cast, Boneyard cast, and release all remained correct;
page and console error arrays were empty. The task-owned host and preview
exited with no listeners left on their ports.

Mac visual receipts are
`/tmp/solomon-dark-game-surface-mac-idle-20260815.png` (SHA-256
`605f2605e4214408db90a9daca5254030f53b19e5b5d6286e7e9cb46d07482af`)
and `/tmp/solomon-dark-game-surface-mac-held-20260815.png` (SHA-256
`9dd5b51b8ba3ae0e22b9e34e0c55f10df8752436afad90a20bb2c631e6a0aafd`).
Both show an ordinary Hub frame with idle/active joysticks and no selection,
drag ghost, callout, or stuck state.

This closes content-owned browser defaults on the shipped `/game` tree. It is
not physical-phone proof: OS/browser-reserved edge navigation, Home/notification
gestures, and browser chrome remain the explicit platform-owned difference
outside installed or supported fullscreen mode.
