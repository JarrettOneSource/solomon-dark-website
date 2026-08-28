# 2026-08-26 College music, wizard identity, facing, and dialogue corrective pass

Reported smell: the restored post-Tutorial College walk had no audible music,
showed the wrong wizard, and did not make its facing/dialogue membership clear.
The current browser trace confirms the identity defect: `startCollegeIntro`
connects a finalized Ether/Arcane config, starter garments fall back to the
Ether palette, and `HubPlayerView` paints the Ether staff effect before Create.
The current responsive smoke reaches both title cards and Office but records no
music-current-time/gain receipt and does not assert the actor's path-facing or
pre-Create appearance.

## Evidence and recovered membership

| Member | Retail evidence | Native contract | Web disposition |
| --- | --- | --- | --- |
| College song | Courtyard vtable `+0xB8 -> 0x00508B20`; direct gameplay references `0x0050F8E0/0x00510DA0/0x00511080/0x00512C60` | request and retain `academy` from Courtyard through Office | exact-port and prove successful, audible, advancing playback |
| legacy song sibling | `academyold` has only generic script-dispatch reference `0x00689750` | parser-addressable, not a College scene selector | keep outside the College mapping |
| pre-Create selection | `Skills_Wizard +0x82C == -1`; element helper `0x0053B1D0` returns for negative selection | no selected-element staff effect before Create | suppress the placeholder Ether effect until loadout confirmation |
| College garment base | `0x005CFC62..0x005CFD62` under `DAT_00B3BCA0 != 0` | base `(0.25,0.5,0.25,1)`, three unsigned `[0,0.1]` channel jitters, clamp, then `0.8*luminance + 0.2*channel` | generate once authoritatively and persist identical Hat/Robe primary tints with white trim |
| selected-element garment siblings | `0x005CFAE3` switch roots `8/16/24/32/40` | Ether `(1,.1,1)`, Fire `(1,.1,.1)`, Air `(.1,1,1)`, Water `(.1,.5,1)`, Earth `(0,.75,0)` use the same jitter/mix owner | close the whole starter-color family, not a College-only green constant |
| first visible facing | base ctor `0x006287D0`; Courtyard `0x00503CE0 -> 0x00503100` | first target `(1074,839)` from `(972,1044)`, about `26.45` degrees/index `2`; later facing follows each spline target | seed admission heading from the first target and retain movement-derived headings |
| Office facing sibling | `0x00504670 -> 0x00503100` | transformed Office target owns facing during forced approach | assert direction-to-target throughout the second path |
| browser local-prediction owner | Mac Chrome diagnostic at Title 9; `game-client-session.ts`, `hub-prediction.ts` | authority had west-facing index `18`, while local presentation stayed at initial index `2`; reconciliation preserved the prior local heading and prediction understood ordinary Region transitions but not `collegeIntro` splines | predict the same Courtyard/Office target and accept authoritative scripted facing at each reconciliation |
| automatic dialogue | sole `ARCH_INTRO_0` story-builder ref `0x00514478` plus sixth-contact action | only `ARCH_INTRO_0` auto-opens; its shipped voice plays | keep exact auto-open/voice receipt |
| remaining phase-zero dialogue | Arch Q1/Q2/Q3/Dismiss and complete Polisher graph | choices, continuation, or explicit Polisher interaction only; Title 7/9 have no narration | assert no automatic Polisher/extra title dialogue |

## Implementation consequence

- Keep the valid wire config as a transport placeholder, but derive admission
  presentation from authoritative College/loadout state rather than displaying
  that placeholder as a selected wizard.
- Add an exact starter-color kernel covering the five selected roots and the
  College override. Store its result on the real starter Hat/Robe items so
  inventory, world rendering, save, reconnect, and post-Create persistence use
  one value.
- Hide only the selected-element effect while the loadout is genuinely
  unselected; reveal the chosen element after Create confirmation.
- Initialize the College actor with the first spline direction instead of the
  generic south-facing constructor default. Continue using requested movement
  to own all later headings.
- Extend local Hub prediction with the serialized College phase/path cursor and
  Office speed. During a forced College phase, reconciliation must take the
  authoritative heading rather than applying the ordinary user-input rule that
  preserves the previous local facing.
- Preserve `GAME_SCENE_MUSIC.hub = academy`, but close the runtime transition
  with a browser receipt for start, gain, and current-time advance. Do not swap
  in `academyold` to mask a lifecycle defect.
- On the capture-phase user gesture, start each of the six already resident,
  source-keyed music elements at zero gain and return the five inactive members
  to time zero. Later automatic scene changes reuse those unlocked elements;
  they must not allocate a duplicate cached song or mutate one song's element
  to another source.
- Extend the Tutorial responsive acceptance journey with appearance, facing,
  music, and negative extra-dialogue receipts at Title 7, Title 9, Office, and
  Create. No protocol/save version bump is required because item `iconTints`
  already replicate and serialize.

## 2026-08-26 acknowledgement/replay correction

Follow-up report: completing or skipping the Archchancellor introduction could
leave the wizard hard-locked at the desk, and a later load could replay the
College admission. The reproduced web ownership gap has two parts:

- `NativeHubSurface` acknowledged the College program only from a question
  choice. Its browser-only Close/Done/dismissal path removed the modal without
  sending `acknowledge-college-intro-dialogue`, while authority deliberately
  seals movement throughout `arch-dialogue`.
- `armGameSimulationCollegeIntro` treated every `collegeIntroPending` profile
  as unstarted. The pending bit intentionally remains true until Create and the
  Courtyard settlement, so an acknowledged serialized Office participant with
  `collegeIntro: null` was incorrectly sent back to the first Courtyard point.

The web projection must acknowledge once before any College-sourced dialogue
surface closes, including the Skip -> Done -> dismissal completion route. A
question choice may change that surface source to ordinary `world` after its
acknowledgement so later closure cannot submit a duplicate. Arming remains
valid only for the fresh Courtyard state (`region=courtyard`, no transition,
no active College program); an acknowledged Office state and either loadout
transition are already past that edge. This uses the existing serialized
region/transition/program state and requires no wire or save-schema change.

Acceptance must complete the auto-opened intro through Skip/Done rather than a
question, observe the authoritative program become null, observe the saved
Office continuation retain that state and starter tint, prove rearming is a
no-op, then move freely to the Office exit and reach Create. Tutorial
completion still receives the one intended stock College admission; the
correction prevents that admission from repeating after it is acknowledged.
The browser-only pre-game decline policy is separated below.
