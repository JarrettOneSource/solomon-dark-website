# Browser compositor regression

The 2026-08-11 Chromium smoke pass found that applying `will-change: transform`
to the full `2000x1024` hub world can promote the scrolled scene into a blank
black texture while separately composited descendants (actors and HUD) remain
visible. Removing that hint immediately restores the unchanged stock courtyard
pixels and every depth layer. The native game has no corresponding compositor
promotion, and the hub world already receives an explicit transform, so the
hint is both unnecessary and visually incorrect. Keep `will-change` only on
small actor/VFX nodes whose promotion does not exceed the browser texture path.

Confidence: high from before/after CDP screenshots in the same page and DOM
state, with all images decoded and no runtime errors.

## 2026-09-22 — Report 11 white-playfield investigation

The original `1551776639195553792__image.png` was inspected directly. It shows
a white playfield with intact HUD, Dire Aliss health bar, 40 FPS, 356 ms and a
disconnected party member. There is no video, duration, save or browser log.
The separate module-error image does not establish ordering or a shared cause.

Before changing presentation, the causal and sibling sweep reused entry 083's
complete Region flash writer census: retail 0.72.5, preferred base `0x00400000`,
SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Region owns one RGBA/loss lane at `+0x8E14..+0x8E24`; `0x00448600` replaces it,
`0x0063EFC0` subtracts float32 loss per 100 Hz tick, and `0x0046EC80` paints it
after the world and before HUD. Stoneskin, Teleport and Comet legitimately
write opaque white with respective losses `.1`, `.025`, `.005`. Primary,
secondary and boss events share that lane. Do not suppress a native flash
merely because a still shows white. A persistent white screen is not proven
native by this evidence either.

Current-main `ed0a2d598` already repairs the independently reproduced Mage
light-registration lifetime exception across interpolation, orphaning,
replication and save/retirement. The September 20–21 performance receipts were
reviewed; no new performance claim or duplicate optimization is justified here.

Validation inventory: both complex-lighting modes; white flash birth, frozen
simulation tick, decay and run teardown; Dire Aliss primary/secondary and
faculty siblings; current Mage birth/orphan/retirement boundary; WebGL context
loss/restoration. These are controlled candidate checks, not reconstruction of
the reporter's unknown live state. Record any reproduction and disposition
before renderer changes. The original white frame's cause remains unassigned.

### Controlled Mac acceptance and final dispositions

Chrome `153.0.8010.53`, built candidate based on `e2ca812e8`, private loopback
host/browser, 1600x900. `tools/smoke-white-playfield.mjs` traverses
Title/Create/College/Boneyard and sends a native Comet semantic flash through
the real host, wire and renderer. It does not reproduce the original fight.

| Member | Disposition | Observation |
| --- | --- | --- |
| Complex Lighting on | verified-already-at-parity | sampled white alpha `.9850000143`; zero by tick `355.4`; world/HUD visible after retirement |
| Complex Lighting off | verified-already-at-parity | sampled white alpha `.9950000048`; zero by tick `325.19`; world/HUD visible after retirement |
| Frozen Region time and new-run lane | verified-already-at-parity | repeated birth-tick samples stay at alpha one; float32 Comet decay retains a positive residue at age 200 and reaches zero at 201; fresh run starts clear |
| WebGL loss/restoration, both lighting modes | verified-already-at-parity | context restored, frames advance, alpha zero; screenshots inspected and world pixels present |
| Dire Aliss, Sirmin, Lucritius primary/secondary/death | verified-already-at-parity | all nine existing Faculty browser cases pass, including animation, audio, effect and retirement assertions; error arrays empty |
| Mage pulse birth/orphan/retirement, both contact forms | verified-already-at-parity | existing headed `check-mage-light-browser.mjs` passes both membership boundaries and all live ages with empty errors |
| Original unsampled white state | out-of-system for a proven renderer change | still image gives neither duration nor triggering state; cannot distinguish a native flash from a stalled world without additional evidence |

Post-recovery page, console, failed-response and failed-request arrays are
empty. Deliberately blocked ModPowerups and browser-cancelled resource requests
during navigation/UI replacement are recorded separately, not counted as
unexplained faults. HTTP failures and non-cancellation network errors still fail.
No renderer code, native flash constant, or graphics setting was changed.

### Nearby late-run transport evidence

A read-only production SQLite query found diagnostics 189 and 190 at
`2026-09-22T01:46:08Z` (Firefox and Opera), both failing with
`frame.world.mageLightningPulses[0] exceeds the live pulse age limit`.
Related performance records 184–188 identify run
`eb1e284360d931a965a41c2fa252ac9b`, revision `ed0a2d598`. Neither record reports
a JavaScript renderer exception corresponding to the white screenshot. This
is a concrete lead for the separately assigned late-run crash (reports 05/10),
not proof of the white frame's cause or of a missing ModPowerups response.

The follow-up should inspect the Game Over clock boundary: entry 097 proves
native Arena freeze with independently advancing terminal-player/Game Over
clocks; `stepGameSimulationTick` preserves the enemy store in that branch,
while `projectBoneyardMageLightningPulses` projects retained rows and the wire
validator compares birth against the advancing snapshot tick. This source
trace is a hypothesis until reproduced against the captured terminal state.
Do not silently discard frozen native actors or relax the five-age validator
as a screenshot fix. The original diagnostic records remain on the server;
no production runtime or database was changed.

Report 10 subsequently reproduced that exact rejection through the real Mac
simulation and compact decoder, and repaired the stopped-Arena/live-terminal
clock boundary across transport and rendering. Its source evidence, contact
membership and acceptance are recorded in entry 097. This establishes a real
crash defect, without assigning the unsampled white frame or preceding lag to it.

Report 11 remains an investigation for the original white frame despite the
independently fixed module-recovery defect in entry 145. No fixed Discord
reaction is justified without resolving that ambiguity.
