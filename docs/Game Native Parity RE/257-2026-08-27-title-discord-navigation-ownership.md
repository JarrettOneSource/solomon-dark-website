# 2026-08-27 — Title Discord navigation ownership

## Requested behavior and system boundary

- Requested Website behavior: remove Discord from the centered Main Menu
  button stack and expose it as a small icon at a screen edge; activating the
  icon opens the existing Solomon Darker Discord invite.
- Current web behavior at `abd744d5`: `RootActions` owns a fifth `discord`
  `MenuButton`; `title-menu-renderer.ts` paints a fifth stock-style plaque;
  `main-menu.css` writes `DISCORD` over it; and the shared `MenuButton` was
  widened into an anchor/button polymorph solely for that row.
- Boundary: the native Title action system remains the four recovered root
  rows and their semantic hit targets. Discord navigation is Website chrome,
  outside that native system, and owns only one root-screen anchor, one icon,
  its invite target, and its accessibility/focus presentation.

## Evidence and membership sweep

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Explicit product direction | user request, 2026-08-27 | Discord must no longer look or behave like a Main Menu row; it should be an edge/corner icon that opens the server | high |
| Existing native evidence | Title-button ledger entry; `0x0059A9D0` | the native root constructs four plaque buttons with the shared click-only sound lane | high |
| Current web causal trace | `MainMenuScene.tsx`, `main-menu.css`, `renderer/title-menu-renderer.ts`, `main-menu-presentation.test.ts` at `abd744d5` | the added fifth row crosses semantic input, Pixi painter state, CSS label paint, and tests; removing only its text would leave false title-menu membership | high |
| Existing Website asset | `frontend/public/icons.svg#discord-icon` | the exact Discord glyph already exists; no generated or approximate icon is needed | high |
| Existing edge ownership | account identity at top-left; revision at top-right; Quit and Fullscreen at bottom-right | the bottom-left is the unowned interactive title corner and avoids all existing controls | high |

| Member / branch | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Play, Explore, Settings, Hall plaques | native Title root, `0x0059A9D0` | `verified-already-at-parity` | renderer and semantic navigation each retain exactly four root rows |
| `discord` title action and fifth Pixi plaque | prior Website extension | `out-of-system`, remove completely | no `discord` action union member, renderer button, CSS plaque label, hover state, or semantic row remains |
| shared `MenuButton` anchor polymorphism | prior fifth-row implementation | `out-of-system`, remove completely | the stock semantic overlay returns to a button-only contract |
| bottom-left Discord icon | Website navigation chrome | `out-of-system`, exact requested adaptation | root-only icon is visually separate from the native stack and uses the existing glyph |
| invite activation | existing `https://discord.gg/HGHxZgyM2p` Website destination | `out-of-system`, exact requested adaptation | native anchor opens a new tab with `noreferrer`; pointer and keyboard activation both work |
| prompt and screen lifecycle | `MainMenuScene` root/play/prompt owner | `verified-already-at-parity`, strengthened | icon exists only on the unobstructed root and cannot pierce a title prompt, fade, submenu, or later scene |
| safe area and touch target | `.main-menu-page` safe-area padding and title-stage viewport | `out-of-system`, exact Website platform contract | bottom-left placement follows the safe-area inset and coarse-pointer target is at least 44 by 44 CSS pixels |
| account, revision, Quit, Fullscreen controls | existing independent edge owners | `verified-already-at-parity` | their geometry and lifecycle are unchanged |

No member is browser-blocked. This pass recovers no new native fact, so no Mod
Loader report or catalog update is required.

## Implementation consequence and validation contract

- Remove Discord from `TitleMenuAction`, the Pixi root-button collection, the
  native semantic row group, and the plaque-label CSS. Restore `MenuButton` to
  a button-only element.
- Add one root-only semantic anchor directly under the title-stage owner. Use
  the existing Discord symbol, a compact brand-colored icon treatment, a
  bottom-left screen-pixel anchor, and the existing click cue on activation.
- Focused contracts must prove the four-row renderer, absence of Discord menu
  membership, exact invite/new-tab attributes, icon-only accessible label,
  bottom-left placement, and 44-pixel coarse-pointer target.
- Mac validation requires the canonical `./scripts/validate.sh` gate and a
  real Chrome root-menu journey that checks the icon geometry and visible
  glyph, opens the exact invite in a popup/new tab, and records empty page,
  console, and failed-response arrays for the game page.

## Implementation validation receipt

- Candidate `ee36a83e` has tree
  `18c139b329c80499fb32c380c200c7fe0fa05639`. The local and detached Mac
  worktrees matched that exact tree before validation.
- The Mac mini canonical gate passed all 26 backend contracts and 2,430
  frontend/desktop tests, including `Discord is a root-screen corner icon,
  not a native menu row`; lint, type checks, backend and frontend production
  builds, game-host build, media policy, and CSP checks also passed. The game
  entry measured 479,153 raw / 134,135 gzip bytes under the 524,288 / 134,144
  limits. Gate-log SHA-256 is
  `df7ea0e225f827052d2554e10552875a8e5986a6a8a569ed4a55d511561f0ec3`.
- Mac Chrome `151.0.7922.174` used WebGL and passed desktop `1600 x 900` plus
  coarse-pointer landscape `896 x 414` journeys. Both exposed exactly Play,
  Explore the Dark Cloud, Settings, and Hall of Fame as native rows, with no
  `discord` title action. The icon measured `(10,852,38,38)` on desktop and
  `(10,360,44,44)` on touch; its external SVG glyph had nonzero bounds.
- Pointer click and focused Enter activation each opened exactly
  `https://discord.gg/HGHxZgyM2p`. The icon was absent under the tutorial
  prompt and Play submenu, then returned on the unobstructed root. Page,
  console, and failed-response arrays were empty in both contexts. Browser-log
  SHA-256 is
  `8a406a71912415866efc0d836f593a78c6d80e36c5ab49ec22c8854682124366`.
- Reviewed desktop/mobile captures are retained at
  `/home/user/.codex-evidence/discord-title-icon-20260827-desktop.png` and
  `/home/user/.codex-evidence/discord-title-icon-20260827-mobile.png`, with
  SHA-256 values `caef7fda5a05879fcf7e8c9e6f22bfa82080b22b4c168defafe8959c3c22e781`
  and `77d006ca039c696466245838f28ab989471e648eabea59df8b8d70d0e82b50c1`.
  The icon is legible and does not overlap the centered menu or bottom-right
  Fullscreen/Quit controls. No deployment was performed.
