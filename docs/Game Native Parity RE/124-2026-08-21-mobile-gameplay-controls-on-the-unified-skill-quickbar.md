# 2026-08-21 — Mobile gameplay controls on the unified skill quickbar

## Reported smell and parity question

- Coarse-pointer gameplay had `152`-logical-pixel movement/primary joysticks,
  no touch producer for any of the eight skill quickbar slots, image-only red
  and blue potions, and backpack/tome hit rectangles that shrink to roughly
  `25 x 27` CSS pixels at `844 x 390`.
- Stock behavior to preserve is the current complete quickbar contract: right
  mouse plus keys `1..7` address eight actor-owned slots; a slot may contain a
  primary, secondary, or staff-driven public skill and enters the existing
  fixed-tick dispatcher. Potion use and Inventory/SkillScreen entry remain
  participant-owned authoritative actions shared by Hub and Boneyard.
- Falsifiers are a touch-only spell/potion path, category-specific UI dispatch,
  client-local economy mutation, lost short press, source-stealing release,
  overlapping hit targets, modal controls below the fullscreen button, or a
  Hub/Boneyard membership difference.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native RE | retail Beta `0.72.5` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `native-input-model.md`; `GameWindowProc 0x00443440`, `Input::Refresh 0x00429820`, `PlayerActor::Tick 0x00548B00` | movement/cast are sampled levels; Inventory is `0x17`, Skills `0x14`, quickbar slot 0 `0x201`, slots 1..7 `0x02..0x08` | high |
| Current native closure | Website current-main all-skill ledger; quickbar presenter `0x005D3E10`; dispatcher `0x0054CC50`; complete 83-row skill catalog | all eight slots share one semantic input and can contain the full currently supported public skill membership; touch must address slots, not duplicate per-skill behavior | high |
| Inventory/SkillScreen closure | potion consume `0x0056D1B0`; Inventory `0x005C6F10`; Skills `0x005CA640` | the six potion subtypes remain in Inventory; only red health and blue mana own bottom-HUD anchors; both books are actor-owned modal roots | high |
| Current web causal trace | Website `a2f749e`; `SkillQuickbar.tsx`, `gameplay-input.ts`, `GameHud.tsx`, Hub/Boneyard scenes | mouse/keyboard already publish `cast.quickbar`; the quickbar has no pointer producer, potions are images, backpack/tome are undersized buttons, and both scenes share the same session/economy seams | high |
| Responsive geometry | `game-viewport.ts`, `touch-joystick.css`, production joystick smoke | display scale is `390/900`; requested exact `1.25` geometry is base `152 -> 190`, knob `64 -> 80`, producing `82.33` CSS-pixel bases | high |

No new retail address or reusable native fact is recovered, so the Mod Loader
reports do not receive a duplicate browser-policy entry.

## System boundary and membership inventory

Native system: coarse-pointer producers for existing actor-owned movement,
primary cast, unified quickbar, inventory consume, InventoryScreen, and
SkillScreen intents. The boundary ends at `PlayerCharacterInput` or the strict
inventory action; skill/staff simulation, effects, audio, replication, save,
and modal owners remain unchanged.

| Member | Native/current owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| movement joystick in Hub and Boneyard | movement level / `0x00548B00` | verified-already-at-parity | existing lifecycle journey plus exact `1.25` geometry |
| primary aim/cast joystick in Hub and Boneyard | aim `0x0042FF80`, player tick | verified-already-at-parity | existing press/hold/release and heading proof plus exact geometry |
| quickbar slot 0 / right mouse | binding `0x201`, unified dispatcher | exact-ported | touch/mouse source composition and browser cast |
| quickbar slots 1..7 / keys 1..7 | bindings `0x02..0x08`, unified dispatcher | exact-ported | every slot, nested hold/release, non-overlapping hit targets |
| every public primary/secondary/staff-driven skill assignable to the quickbar | current complete 83-row catalog and selector dispositions | verified-already-at-parity | current per-skill closure; touch publishes only semantic slot identity |
| health-potion HUD shortcut | red anchor, subtype `0` | exact-ported | exact stack id, decrement, effect/audio authority |
| mana-potion HUD shortcut | blue anchor, subtype `1` | exact-ported | exact stack id, decrement, effect/audio authority |
| rejuvenation and potion subtypes `2..5` | InventoryScreen membership | out-of-system (no bottom-HUD anchor; retained in Inventory) | six-subtype Inventory suite |
| backpack and tome taps in Hub/Boneyard | Inventory/Skills openers | verified-already-at-parity | enlarged hit target and shared modal journey |
| fullscreen exclusion during Inventory/Skills | native modal hit-test precedence | exact-ported | topmost close-button journey |
| pointer up/cancel/lost capture, blur, hidden/page hide, barrier, teardown | native reset plus browser lifecycle | exact-ported | synchronous idle/release regressions |
| desktop fine pointer | native mouse/keyboard profile | verified-already-at-parity | coarse-only CSS/input controls |
| portrait coarse pointer | explicit orientation gate | out-of-system (gameplay remains gated behind rotate-to-landscape) | existing device smoke |

No member is blocked by the browser platform. The requested joystick size and
non-overlapping `100`-logical-pixel touch rectangles are explicit browser
policy with no retail-mobile oracle.

## Recovered behavioral contract and web consequence

- `BrowserGameplayInput` owns source-qualified mouse, keyboard, and touch
  quickbar holds. Releasing touch slot 0 cannot release right mouse; releasing
  a newer slot reveals an older held slot. Press publishes synchronously and
  the fixed-tick host derives the action edge.
- A touch press preserves retained aim. If no aim exists, it seeds the recovered
  world projection from the replicated 24-heading player facing. It never
  selects a skill category or invokes a skill/staff kernel directly.
- Potion taps choose the first matching actor-owned backpack stack and send the
  existing strict consume action. Empty shortcuts are disabled; host feedback,
  effect, audio, Hall streak, replication, and save behavior are unchanged.
- Both joystick dimensions scale by exactly `1.25`; normalized direction and
  post-transform coordinate ownership are unchanged. Eight quickbar controls
  occupy a separate row. Potion/backpack/tome centers are spaced by `110`
  logical pixels. Native art stays inside the enlarged semantic rectangles.
- The persistent fullscreen control is removed from hit testing whenever
  InventoryScreen or SkillScreen owns the modal root.

## Confidence, unknowns, and validation contract

- Confirmed: bindings, slot/category membership, actor/session authority,
  potion identity, modal ownership, current responsive transform, and exact
  requested joystick ratio. There is no simulation inference.
- Physical-device hand comfort is non-material and unverified. Chrome mobile
  emulation proves geometry/events, not phone grip ergonomics.
- Focused coverage must prove all eight touch slots, nested release order,
  mouse/touch slot-zero composition, barrier cleanup, first potion-stack
  selection/count, and exact heading projection.
- Production Chrome at `844 x 390` must prove `190/80` computed geometry,
  eight topmost non-overlapping quickbar controls, one replicated slot-zero
  cast, both potion decrements, Inventory/Skills open and close in both scenes,
  simultaneous twin-stick input, Boneyard cast, and empty page/console errors.
- The final exact current-main tree must pass `./scripts/validate.sh`; Mac and
  Windows browser receipts remain separate. No publication or deployment is
  authorized.

## Implementation validation receipt

- `BrowserGameplayInput` now owns source-qualified mouse, keyboard, and touch
  quickbar holds. Focused regressions address slots `0..7`, last-held ordering,
  touch/right-mouse slot-zero composition, facing-derived initial aim, barriers,
  and interruption. No quickbar skill category receives a separate touch path.
- Both joysticks are exactly `190 x 190` logical pixels with `80 x 80` knobs.
  The eight quickbar buttons form a separate non-overlapping row. Red/blue
  potion buttons select the exact first matching stack; the four bottom HUD
  controls use non-overlapping `100`-logical-pixel targets. InventoryScreen and
  SkillScreen remove the fullscreen control from hit testing.
- The exact current-main Mac tree at base `a2f749e` passed the complete
  `./scripts/validate.sh` gate on Apple M2/macOS `26.4.1`: backend build and
  `13/13` contracts, lint/import boundaries, Library, loot, all `216/216`
  prerequisite/save/skill tests, the expanded all-skill broad game suite,
  parties, level-up, `7/7` diagnostics, `15/15` Hall, `15/15` Hub UI including
  the new potion shortcut test, `5/5` desktop tests, production build, bundle
  budget, and media policy. The entry is `344882` raw / `97472` gzip bytes.
- Mac Chrome `151.0.7922.170` and Windows Chrome production journeys at
  `844 x 390` each proved computed joystick base size `82.33 x 82.33` CSS
  pixels, centered knobs, all eight topmost non-overlapping quickbar targets, a
  replicated Ring of Ice slot-zero cast, both potion decrements, Inventory and
  Skills open/close in Hub and Boneyard, rightward Water heading `6`, concurrent
  movement/primary contacts, Boneyard cast, all `17` rapid/held pointer defaults
  canceled, and empty page/console error arrays.
- Current-main captures are
  `/tmp/solomon-mobile-controls-current-mac-{idle,held}.png` and
  `C:/Users/User/AppData/Local/Temp/solomon-mobile-controls-current-windows-{idle,held}.png`.
  Chrome emulation is not a physical-phone ergonomics receipt.
- No member is `blocked-by-platform`. Non-red/blue potion subtypes remain
  explicitly `out-of-system` only for the bottom-HUD shortcut and remain in
  Inventory. No commit, push, deployment, or production verification was
  performed or authorized.
