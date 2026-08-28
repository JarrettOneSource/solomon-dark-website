# 2026-08-26 — Corrective SkillScreen pointer-drag closure

## Reported smell and parity question

- Reported behavior: dragging a spell from SkillBook does not assign it to the
  belt even though the screen says gold/green skills can be dragged there.
- The 2026-08-20/25 entries called drag/drop exact, but their browser journey
  used Playwright `dragTo` against the invisible DOM quickbar target. It did
  not exercise release over the painted, modal-slid belt and omitted the
  native transient dragger, hit rectangle, threshold, and audio. This is a
  secondary-report process failure; those claims are reopened here.
- Stock question: recover the complete HoverButton -> SkillDragger -> live
  BeltButton path for every category, accepted/rejected release, both scenes,
  and mouse/touch projection.
- Falsifiers: point-only hit testing, a stationary source icon, a four-pixel
  threshold, unslid belt targets, sound on rejection, silence on acceptance,
  category-3 drag, or a test that targets invisible geometry.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Canonical current read-only replica target. | high |
| Fresh instructions | `0x00656980`, `0x0065E4D0`, `0x006564A0`, `0x005C7090`; vtable `0x0079F564`; raw call at `0x00656529..46` | Strict threshold, transient art, pointer-centered overlap, slot winner, accepted sound, and unconditional teardown. | high |
| Static values/assets | `0x0078473C=9`, `0x007849B0=40`, `0x00784D58=1.25`; Skills record 164 and icon rows 27..122 | Exact threshold squared, drag rectangle, scale, glow, and icon membership. | high |
| Current Website | `SkillBook.tsx`, `skill-book.css`, `skill-book-renderer.ts` at `b4a75dc8` | Uses `>16`, point containment against fixed closed-position DOM actions, no pointer icon/glow, and no accepted-drop sound. | high |
| Mac baseline | exact detached current main; canonical gate and `smoke:game:skill-book` | Full gate passes and hidden-target `dragTo` reports success, proving the prior acceptance cannot falsify the painted-target report. | high-live |

## System boundary and membership inventory

Native system: the complete transient SkillScreen drag owner from authored
card admission through pointer threshold/capture, SkillDragger presentation,
live BeltButton overlap, authoritative slot mutation, audio, and teardown.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| category-1 primary rows, including Welding 52 | category predicate `0x0067BEB0` | exact-ported | every learned primary can drag; selection click remains independent |
| category-2 secondary rows | predicate `0x0067BF10` | exact-ported | natural pointer drop and duplicate/occupied slots |
| category-3 concentration | `0x0067BEE0`, common category router | verified-already-at-parity; out-of-drag by design | click selects; pointer movement creates no dragger |
| passive categories 0/4 | authored category | verified-already-at-parity; out-of-drag by design | no dragger or assignment |
| strict movement threshold | `0x00656980`, value 9 | exact-ported | squared displacement 9 rejected, greater than 9 starts once |
| HoverBox interruption | `HoverButton +0xB8` | exact-ported | drag start destroys hover and no stale tooltip remains |
| pointer-owned SkillDragger | vtable `0x0079F564` | exact-ported | one transient follows live pointer and always tears down |
| glow/icon/Welding presentation | `0x0065E4D0`; Skills 164, 27..122 | exact-ported | root color plus exact live icon at scale 1.25 |
| eight live modal-slid BeltButtons | `Game+0x5EC`, stride `0xEC`; `0x005C7200` | exact-ported | semantic targets and hit model share current HUD rectangles |
| centered 40x40 maximum-overlap selection | `0x006564A0 -> 0x005C7090` | exact-ported | point-outside overlap, greatest-area winner, earlier tie |
| empty and occupied destination | BeltButton slot writer | verified-already-at-parity | one addressed replacement only |
| duplicate skill ids | no source scan | verified-already-at-parity | duplicate Call Leviathan remains legal |
| accepted/rejected audio | registry 1 `pickskill`, gain 1 | exact-ported | exactly one accepted cue; rejected/cancelled silent |
| Hub and Boneyard consumers | shared `Gameplay+0x1664` screen | exact-ported | same mouse and touch journeys in both scenes |
| close/handoff/cancel/teardown | `0x006564A0`, `0x0066B200` | exact-ported | pointer cancel, release outside, close during no drag leak |

No member is blocked by the browser platform.

## Native ownership and behavioral contract

- Movement squared must exceed 9 before one SkillDragger is constructed. Its
  live position is the pointer center in native stage coordinates.
- Render order is root-colored Skills 164 glow then the exact authored/live
  build icon, both centered and scaled 1.25 above the screen.
- Release forms `[pointer.x-20,pointer.y-20,40,40]`, intersects every current
  belt rectangle in order, and accepts only the strictly greatest positive
  area. A point outside a slot can therefore still be a valid stock drop.
- Success sends the existing actor-authoritative assignment, plays
  `pick-skill` once, and destroys the dragger. Rejection/cancel destroys it
  without mutation or sound. Duplicate IDs and one-slot replacement remain.

## Web implementation consequence and validation contract

- Put constants/overlap selection in the SkillScreen model/render contract;
  convert Pointer Events from client to the fixed native stage once.
- Drive both hit actions and overlap selection from
  `nativeHudModalSlideLayout(...,openProgress).belt`; remove fixed nth-child
  geometry. Add the pointer glow/icon above hover/HUD content.
- Red contracts must reject threshold 16, point-only selection, fixed belt
  actions, missing dragger, and missing sound.
- Mac Chrome must start at a painted card, show the moving dragger, release at
  the painted lower slot edge where the pointer is outside the old DOM target
  but its 40x40 native rectangle overlaps, then prove authoritative mutation and
  one `pickskill`. Also prove outside release and category-3 movement reject.

## Implementation validation receipt

- Implementation: `skill-book-model.ts` now owns strict displacement-squared
  threshold 9 and the centered 40x40 greatest-overlap selector. `SkillBook`
  converts client Pointer Events into native 1600x900 stage coordinates,
  drives the selector from the live modal-slid belt, clears hover on drag,
  handles cancel/reject teardown, sends the existing authoritative slot action,
  and plays `pick-skill` only on a positive hit. The eight semantic buttons use
  those same live rectangles; the fixed CSS/nth-child geometry is removed.
- Presentation: `skill-book-renderer.ts` owns a top transient layer that paints
  Skills 164 in the row's native root color and the exact skill/live Weld icon
  at scale 1.25 under the pointer. The layer is destroyed on every release,
  cancel, close, or screen teardown.
- Red receipts: the tests-only canonical Mac gate stopped on the five missing
  native drag exports. The painted-coordinate browser journey then timed out
  before Quickbar 3 mutation/current-main had no transient dragger marker;
  `red-website-validate.log` and `red-skillbook.log` retain those failures.
- Mac Chrome: the green journey starts Magic Missile at `(700,359.5)`, moves
  the visible 1.25x dragger, and releases at painted slot-3 point
  `(614.5,899)`. That point lies below the old fixed DOM action but its native
  40x40 rectangle overlaps the live slot; the host assigns skill 8 and exactly
  one gain-one `pickskill` event plays. Duplicate Call Leviathan, occupied /
  empty slots, Hub/Boneyard consumers, selectors, and empty page/console/
  network error arrays remain green. Log: `evidence/green-skillbook.log`.
- Visual inspection: `green-skillbook-painted-drag.png` shows the authored
  purple glow/icon following the pointer over the outlined live belt target;
  no stale HoverBox remains.
- Automated acceptance: Website canonical Mac gate passes Boneyard/game
  `1573/1573`, Tutorial `50/50`, every backend/frontend/desktop/lint/type/build/
  media contract, and game bundle `474613` raw / `133080` gzip against
  `524288` / `133120`. Mod Loader static RE passes `507/507`. Logs:
  `evidence/final-website-validate.log` and `evidence/final-loader-static-re.log`.
- No browser-platform member or material unknown remains. Changes are local;
  no commit, push, deployment, or production mutation was requested.
