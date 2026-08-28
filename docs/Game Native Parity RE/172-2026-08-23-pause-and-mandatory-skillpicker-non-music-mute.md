# 2026-08-23 — Pause and mandatory SkillPicker non-music mute

## Reported smell and parity question

- Reported web behavior: gameplay sounds, voices, streams, and persistent loops
  remain audible while the Pause Menu or mandatory skill picker owns the
  screen.
- Requested behavior: mute every non-music game-audio member for the complete
  Pause/SkillPicker presentation lifetime while music and its live crossfade
  remain audible; restore the current user sound setting afterward.
- Reproduction scenes: local Hub Pause Menu; owner and waiting-peer Boneyard
  pause; LevelupScreen opening, settled choice, reroll/rebuild, closing, and
  cohort-waiting branches; compact HUD primary/A/B selector owner and waiting
  peer; overlapping state transitions and teardown.
- Falsifiers: a stock modal call to a sound-only mute owner; a web cue that
  bypasses the resident-buffer master; music routed through that master; a
  setting change while muted that restores the stale pre-change value; or a
  closing/waiting picker branch that releases early.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | `SolomonDark.exe` 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, image base `0x00400000`; `SimpleMenu_ModalLoop 0x005ABF10`, instruction ranges `0x005AC098..0x005AC0D4`; LevelupScreen open/destructor `0x0067CAC0..0x0067CAED` / `0x006588C0` | Both modal families hold the active region through `0x005CBD40`; neither calls an audio gain setter or `Audio::Pause`. SimpleMenu requests stream 131 on return; LevelupScreen requests `openpanel` on entry. | high |
| Retail audio owner | `Audio::Pause 0x00407400`; sound/music setters `0x004073A0` / `0x00407340`; `Audio+0x78..+0x88`; BASS configs 4/5/6 | Native global pause is nested but calls device-wide `BASS_Pause`, which also pauses music. Sound and music otherwise have independent persisted/effective lanes. | high |
| Native assets/classes | registry rows/classes in `native-audio-catalog.json`; `Sound`, `SoundStream`, `SoundLoop`, `AmbientSound`, `Music` | All web one-shots, streams, loops, ambience, and voice requests use the non-music resident-buffer playback master; music uses independent `HTMLAudioElement` channels. | high |
| Current Website | `game-audio-director.ts`, `game-audio-web-playback.ts`, `MainMenuScene.tsx`, `SkillPicker.tsx`, `GameplayPauseMenu.tsx` at Website `b57eab6f` | The correct bus seam already exists, but the director stores no temporary mute multiplier and modal state never drives it. | high |

## System boundary and membership inventory

Native system: modal world suspension plus the sibling native audio manager.
The sound-only mute is an explicit Website policy because stock neither mutes
these modals nor exposes a sound-only pause operation.

| Member | Native/web owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Local Hub Pause Menu | Website local `displayedGameplayPause` | out-of-system native extension | sound master zero from modal mount through close/Settings handoff; academy music continues |
| Boneyard Pause owner surface | host-authoritative `gameplayPause` | out-of-system native extension | every non-music class silent; Boneyard music continues |
| Boneyard waiting-peer surface | replicated `gameplayPause` | out-of-system native extension | the same client-local bus policy applies even without actions |
| Dark Cloud Explore Pause Menu | Website `darkCloudMenuOpen` using the shared SimpleMenu renderer | out-of-system native extension | non-music UI lane is zero while the Pause surface is present; title music continues |
| LevelupScreen opening and settled offer | `levelUpBarrier` plus `SkillPicker` | out-of-system native extension | mute is established before picker passive effects can request audio |
| reroll/rebuild, close, and cohort-waiting tails | `levelUpBarrier` / `levelUpPickerClosing` | out-of-system native extension | no early release between React surface variants |
| compact HUD primary/A/B selector owner | `hudSkillSelector` plus the `skill-selector` pause source | out-of-system native extension | mute starts with the local compact picker and covers its complete selection/cancel lifetime |
| compact HUD selector waiting peer | replicated `gameplayPause.source === 'skill-selector'` | out-of-system native extension | the peer's frozen world is silent while music continues |
| `Sound` one-shots, including UI cues | resident-buffer master | verified-already-at-parity audio class; temporarily muted by policy | active requests remain lifecycle-correct at zero master gain |
| `SoundStream`, voices, and long effects | keyed resident-buffer channels | verified-already-at-parity audio class; temporarily muted by policy | no stream-specific bypass or restart on release |
| `SoundLoop` and `AmbientSound` | owner-keyed resident-buffer loops | verified-already-at-parity audio class; temporarily muted by policy | reference/owner updates continue while inaudible |
| `Music` current/outgoing channels and crossfade | independent music channels | verified-already-at-parity; excluded from mute | current scene track stays playing at the user music volume |
| sound/music persisted settings | `GameSettings` plus `setVolumes` | verified-already-at-requested-policy | changing sound volume while muted updates the stored scalar; release restores the newest value |
| Inventory, SkillScreen, traders, title/Create, focus loss | independent surfaces/application owners | out-of-system (not requested) | no mute acquisition from these states |
| session/audio teardown | `MainMenuScene` / director destroy | exact lifecycle boundary | no retained gain node, timer, stream, or mute owner |

No member is `blocked-by-platform` and there is no extracted-but-undispositioned
native row.

## Native ownership thread and recovered contract

- Modal input/world ownership remains exactly as documented by the 2026-08-20
  pause and LevelupScreen entries. This change does not alter host ticks,
  barrier arbitration, rendering, input, or no-catch-up semantics.
- Stock audio owns independent user/effective sound and music scalars, but its
  only pause virtual is device-wide. The web equivalent therefore stores the
  latest user sound scalar and applies `soundsMuted ? 0 : soundVolume` only to
  the resident-buffer master.
- Muting does not stop or destroy a source. One-shots, streams, and loops may
  advance silently; owner stop/restart/teardown operations remain authoritative.
  Release never replays events received during the mute.
- The client-local mute predicate is Dark Cloud Pause, a displayed gameplay
  pause whose source is `pause-menu` or `skill-selector`, a locally opening HUD
  selector, or `levelUpModalActive`. Source qualification deliberately excludes
  the sibling Inventory/Skill Book hold.
  A layout-phase write establishes it before SkillPicker's entry requests; its
  inverse restores the latest sound setting. Music volume/envelopes are never
  multiplied by it.

## Web implementation consequence and validation contract

- Add one reversible sound-only multiplier to `GameAudioDirector`; do not
  suspend the shared `AudioContext`, alter per-cue gains, stop loops, mutate
  persisted settings, or add modal checks to every producer.
- Drive it once from the session-level modal owner in `MainMenuScene`, covering
  local and authoritative pause plus the full level-up opening/closing/waiting
  state graph. Expose a diagnostic attribute for browser proof.
- Focused tests must cover user gain before/during/after mute, a setting update
  while muted, idempotent transitions, continuing music/crossfade, and every
  non-music playback class sharing the master.
- Real Mac Chrome must begin a loop/stream, enter Hub and Boneyard pause plus a
  mandatory picker, observe zero non-music master gain throughout, observe a
  still-advancing audible music channel, release, and see the newest sound gain
  restored with no page, console, or failed-response errors.

## Implementation validation receipt

- `GameAudioDirector` now retains the current user sound scalar and applies one
  reversible sound-only master multiplier. `MainMenuScene` drives it in a
  layout effect from Dark Cloud Pause, source-qualified gameplay Pause, and the
  complete `levelUpModalActive` state. Inventory and Skill Book holds remain
  deliberately excluded. The first Mac red failed exactly because
  `setSoundMuted` did not exist; the green director matrix is `42/42`, and the
  combined audio/pause matrix is `60/60`.
- Final functional Website cutoff `2adbee230fbd85ae726a598956d080b71ee4d1c5`
  and Mod Loader cutoff `4e6b34cd2af686d3d5500072f6beb2f0bb2d527c`
  were materialized as those exact commits on the Mac mini. Mod Loader portable
  static RE passed `495/495`.
- Mac `smoke:game:skill-picker` proved the Hub and Boneyard picker predicates
  `true`, their exact game master volumes `[0]`, Academy/Prelude music started
  with no later pause event, and release restored `[1]`. Picker entry/choice
  sources still advanced silently at their exact pitches; failed responses,
  page errors, and console errors were empty.
- Mac `smoke:game:pause` covered large/small Hub, Boneyard owner and waiting
  peer, Settings handoff, disconnect release, and no-catch-up resume. Every
  Pause surface reported the mute; Inventory and Skill Book reported false.
  Browser ownership held ticks `1618..1674`, Boneyard owner tick `2701`, and
  peer-owner tick `2702`, with no smoke errors.
- Mac `smoke:game:skill-book` covered the newly landed compact primary/A/B
  selector in Hub and Boneyard. The opening click precedes modal ownership at
  master one; every selection `click` and `concentrate` request while open had
  `masterVolume: 0`, release restored the gain, and page/console/network arrays
  were empty. Reviewed compact-selector capture SHA-256 is
  `078c57f8ad29f01f510fdae91fef6408c28461a46e85183acd71b8ec80667a92`.
- The complete Mac canonical gate passed at the same functional cutoff:
  backend/contracts and formatting, lint/boundaries, `1416/1416` broad game,
  `61/61` ML, `48/48` party/chat, `36/36` Hall, `23/23` Hub UI, `5/5`
  desktop, production build, media policy, and game-entry budget
  `438667` raw / `123533` gzip. Log SHA-256 is
  `34623d911e0a37baa7e8cf8a491240b8db323bbca772f4fbc755eae8c34f6a91`.
