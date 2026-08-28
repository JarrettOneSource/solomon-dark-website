# 2026-08-26 — Tutorial touch resume controls and NPC onboarding/save revalidation

## Reported smell and parity question

- Reported mobile behavior: opening Inventory during the Tutorial can leave the
  player unable to close it. The stage-10 copy and blinking arrow say to click
  the backpack again, but the painted backpack has no pointer/touch action;
  only keyboard `I`/menu bindings and a clipped semantic back button close the
  Website surface.
- Sibling parity question: stage 13 gives the same instruction over the live
  tome. Skills has a transparent close action, but it is fixed to the
  top-right chrome instead of the tome rectangle addressed by the Tutorial.
- Verification request: exercise a fresh-profile world interaction through
  the visible `E / INTERACT` product extension, confirm that the onboarding
  Tutorial copy and marker state change on the interaction edge, and prove the
  authoritative help row reaches the browser save and survives Last Game.
- Falsifiers: a touch-only stage-10 or stage-13 journey needing a synthetic
  key; a close hitbox that does not follow the 40-tick HUD slide; more than one
  back owner for a surface; wrong close audio; a close that misses the Tutorial
  stage edge; an NPC prompt that remains over Chat; onboarding copy that does
  not clear immediately; or a save/resume that restores row 0 as unacknowledged.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | Inventory keyboard `0x005CB3A3`, HUD callback `0x005D8165`, common opener `0x005C6F10`, standalone close `0x00555810` / audio request `0x00555853` | Keyboard and the painted backpack are parallel entry controls. Inventory open is silent; standalone close requests registry 64 `sounds\\openpanel`. | high |
| Retail instructions | action dispatcher `0x00689750` action `0x406`, Skill opener `0x005CA640`, close `0x006568E0`, tick `0x006567E0` | The tome owns the parallel Skills entry. Close marks the existing screen closing and ramps `0.025` per 10 ms tick for 40 ticks; open/close is silent. | high |
| Retail geometry | HUD layout `0x005D76C0`, modal writer `0x005C7200`, Tutorial render `0x005D08C0` cases 10/13 | Backpack/tome are `58x62`; modal y is `(H-75)+15p`. Stage 10 targets backpack centre and stage 13 targets tome centre throughout the live slide. | high |
| Current Website trace | `HubInventoryUi.tsx`, `SkillBook.tsx`, `skill-book.css`, `TutorialOverlay.tsx`, `BoneyardScene.tsx` at base `6da8d573` | Inventory's only pointer close is a 1x1 clipped semantic button. The stage-10 menu skull remains hidden. Skills' close action is at `top:25px; right:0`, not over the tome. Existing touch smokes open by touch but close by keyboard. | high |
| Existing NPC ownership | 2026-08-24 entry above; `ContextualInteractButton.tsx`, `HubInventoryUi.tsx`, host acknowledgement/checkpoint tests | World interaction sends the bounded acknowledgement before opening Chat; row 0 replicates immediately and uses the normal save checkpoint. The contextual prompt is hidden while a surface exists. | high |
| Current browser harness | `smoke-hub-npcs.mjs#enterHub/#exerciseFreshMarkers` | The journey checks `1111111111 -> 0111111111`, copy removal, visible interaction prompt, Chat, same-room suppression, room reconstruction, IndexedDB checkpoint, and Last Game. Its entry still expects New Game to open Create directly instead of first entering the story Office, and its schema assertion/receipt is stale at literal 11 while the current save contract is schema 14. | high |

No new binary extraction is required. The reusable native facts are already
owned by Mod Loader `native-hud.md`, `native-hub-and-economy.md`,
`native-progression-and-skills.md`, and `native-audio-events.md`; this entry
closes the Website hit ownership and current browser verification.

## System boundary and membership inventory

Native system: gameplay modal entry/close ownership for the bottom-HUD
Inventory and Skills controls, including keyboard siblings, the shared modal
slide, Tutorial teaching-stage edges, audio, mutual exclusion, and teardown.
The NPC rows below are a verification-only neighboring system requested by the
user, not part of the modal implementation.

| Member | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Inventory keyboard open/close | `0x005CB3A3`, `0x005C6F10`, `0x00555810` | verified-already-at-parity | existing bound-key journey and close audio |
| Inventory backpack pointer/touch open/close | `0x005D8165`; live `Game+0x22C` rect | exact-ported | one transparent action over the live slid backpack; touch open and touch close |
| Skills keyboard open/close | action `0x406`, `0x005CA640`, `0x006568E0` | verified-already-at-parity | existing key journey and 40-tick close |
| Skills tome pointer/touch open/close | live `Game+0x2EC` rect | exact-ported | existing close action relocated to the live slid tome; touch open and touch close |
| modal slide/opening/settled/closing | `0x005C7200`, inventory `+0x150`, skills `+0x94` | verified-already-at-parity | action rectangles consume the same live progress as renderer/callouts |
| Inventory close audio | registry 64 at `0x00555853` | exact-ported | backpack touch close requests `open-panel` once |
| Skills close audio | no request across open/close owner | verified-already-at-parity | tome touch close remains silent |
| Inventory/Skills handoff and mutual exclusion | `0x005CA640`; shared gameplay pointers | verified-already-at-parity | no lifecycle/protocol change; existing handoff controls green |
| Tutorial stages 9/10 and 12/13/15 | `Tutorial::Tick 0x005D6330`, render cases 9/10/12/13 | exact-ported | touch target opens, resume target closes, callouts detach at close start, stage advances |
| menu/skull fallback during early Tutorial | Website `BoneyardScene` combat gate | out-of-system (separate pause owner; deliberately hidden before stage 14) | touch journey succeeds without menu access |
| Provokatus contextual interaction prompt | named Website product extension over exact world interaction | verified-already-at-parity | visible before interaction, absent over Chat, correct target label |
| onboarding row-0 copy/marker transition | native help byte `+0x9A`; action `0x005018A0` | verified-already-at-parity | copy clears immediately; same-room ordinary marker remains suppressed until reconstruction |
| row-0 authority/checkpoint/resume | participant economy and slot-0 save | verified-already-at-parity | current schema checkpoint contains `false`; Last Game restores `0111111111` |

No member is blocked by the browser platform.

## Native ownership thread and recovered behavioral contract

- The gameplay HUD owns both visible entry controls and the keyboard
  dispatcher owns their sibling bindings. A modal does not replace the
  backpack/tome control: `0x005C7200` slides that same live rectangle by
  `15p`, so the rendered control, Tutorial pointer, and pointer action must
  consume one progress value.
- Inventory closes immediately in the current Website surface model and plays
  `open-panel`; this preserves the existing authoritative surface/Tutorial
  edge. Skills retains its stock-modeled closing phase, calls
  `onCloseStart` once, ramps to zero over 40 ticks, and remains silent.
- Each open modal owns exactly one discoverable `data-game-back` action. The
  action is transparent because native art remains renderer-owned; its
  accessible label identifies the close operation.
- No game protocol or save-schema change belongs to modal close. Existing
  Tutorial actions at Inventory close start and Skills close start remain the
  sole progression/save writers.
- NPC acknowledgement remains host-authoritative and idempotent. The world
  interaction emits the acknowledgement before Chat opens, surface ownership
  hides the contextual prompt during Chat, and the normal checkpoint persists
  the participant-private help table.

## Web implementation consequence

- Subscribe Inventory's action layer to `native-modal-slide-progress` and
  derive the backpack action from `nativeHudModalSlideLayout(1600,900,p)`.
  Replace, rather than duplicate, the clipped Inventory back owner; retain the
  existing semantic back path for dialogue/service surfaces.
- Derive Skills' existing close action style from the same layout function and
  `openProgress`, selecting the tome rectangle. Remove the unrelated fixed
  top-right dimensions. Do not introduce a second transition or callback.
- Make touch scenarios close Inventory through the backpack action and Skills
  through the tome action. Keep keyboard scenarios as sibling coverage.
- Bring the NPC journey through the current New Game story-Office route before
  Create, matching the already-proven production smoke entry sequence.
- Replace the stale NPC smoke schema literal with the authoritative current
  save-contract constant and report the actual decoded schema version.

## Validation contract

- Tests-first source/layout contracts must reject the clipped-only Inventory
  back owner and fixed top-right Skills owner, then require both live rects,
  single back ownership, correct audio, and existing close callbacks.
- Mac Chrome touch journeys at `896x414` must use pointer clicks for both
  stage-10 Inventory runs and both stage-13 Skills runs, observe stages
  `10 -> 11` and `13 -> 15`, and emit empty page/console/response/host errors.
- The natural Sorceror's Amulet touch journey must equip, checkpoint, close via
  the backpack, and reach stage 11 without a keyboard event.
- The fresh-profile NPC journey must prove visible `E / INTERACT`, Chat-owned
  prompt removal, row/copy transition, schema-14 IndexedDB checkpoint, room
  reconstruction, and Last Game resume with empty error arrays.
- Run the complete Website `/opt/homebrew/bin/bash ./scripts/validate.sh` and
  the relevant modal/NPC browser families on a byte-identical Mac candidate.

## Implementation validation receipt

- Implementation: `HubInventoryUi` now subscribes to the shared modal-slide
  snapshot and gives the live `nativeHudModalSlideLayout(...).backpack`
  rectangle the Inventory surface's visible back action. The action is absent
  while an Inventory child notice/dye modal owns back, requests `open-panel`
  once, and calls the existing close owner. The old clipped Inventory back
  duplicate is gone; dialogue/service retain their pre-existing semantic
  fallback. `SkillBook` relocates its existing close/back action to
  `nativeHudModalSlideLayout(...,openProgress).tome`; its 40-tick silent close
  lifecycle is otherwise untouched.
- Tests-first receipt: the pre-implementation Mac gate exited 1 at the first
  affected sibling. Both prerequisite/full Boneyard invocations rejected the
  fixed top-right Skills close owner (`1568/1570`); no unrelated test failed.
  The implemented gate passes the same source/layout contracts plus the
  Inventory live-slide/single-owner/audio contract.
- Final Mac Website gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` exits
  zero with Boneyard/game `1570/1570`, Tutorial `48/48`, all backend/frontend/
  desktop/lint/type/build/media contracts, and production game entry `474613`
  raw / `133083` gzip against `524288` / `133120`. Logs:
  `evidence/red-touch-close-website-validate.log` and
  `evidence/green-touch-close-website-validate.log`.
- Four-viewport Mac Chrome matrix: stock `1600x900`, wide `2560x1080`, tall
  `1200x1000`, and touch `896x414` pass with empty page, console, response, and
  host-error arrays. The touch client opens and closes both stage-10 Inventory
  variants through `[data-inventory-resume]`, opens and closes both stage-13
  Skills variants through `[data-skill-book-resume]`, observes the existing
  stage edges/callout teardown, and never synthesizes a close key. Touch
  settled resume tips remain backpack `(759.5,871)` and tome `(839.5,871)` in
  native stage space. Log: `evidence/modal.log`.
- Natural mobile amulet journey: `896x414` traverses authored pickup, opens
  Inventory by touch, points at/equips the exact Sorceror's Amulet, checkpoints
  revisions 3 and 6, closes by clicking the live backpack action, and reaches
  Tutorial stage 11. Page/console/response/wire arrays are empty. Log:
  `evidence/amulet-touch.log`.
- Current NPC/save journey: New Game physically traverses the story Office into
  Create, starts at help rows `1111111111`, opens Provokatus from the visible
  `E / INTERACT` action, proves that action is detached for the complete Chat
  surface and restored afterward with `Talk to Provokatus`, observes immediate
  walk-to-talk removal and row state `0111111111`, reconstructs the ordinary
  marker, checkpoints save schema 14, and restores Last Game at
  `0111111111`. Page/console/response arrays are empty on Chrome/ANGLE Metal,
  Apple M2. Log: `evidence/npc-final2.log`.
- Visual inspection: touch Inventory and Skills retain their full native art,
  with the resume arrows visibly landing on the backpack/tome controls. The
  pristine Courtyard frame paints `WALK INTO WIZARDS TO TALK TO THEM` and its
  arrow over Provokatus; the post-interaction frame removes that copy and
  restores the correctly labeled interaction plaque after Chat.
- Unknowns / platform differences: none. No new reusable native discovery was
  made, so the already-authoritative Mod Loader reports remain unchanged.
  Fast-forward publication to `main` is user-authorized and remains pending the
  final fetch, exact-tree identity proof, and remote verification.
