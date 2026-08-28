# Level-transition presentation, picker reveal, and modal world visibility (2026-08-15)

This entry supersedes the fixed-alpha, immediate-input picker presentation and
the two-pitch/per-offer level-up audio statements above. It targets retail
Beta 0.72.5 `SolomonDark.exe`, PE32 preferred base `0x00400000`, size
`4,723,200`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Preferred-image VAs were recovered from the read-only Ghidra project for that
exact image. Durable instruction and membership evidence is recorded in Mod
Loader `docs/skill-picker-re.md` and
`docs/reverse-engineering/native-audio-events.md`; the settled 1600 x 900 stock
witness is
`tests/fixtures/webgame/menu-reference-captures/skill-picker.png`.

## Reported mismatch and root cause

The Website mounted the settled picker immediately, fixed its black curtain at
alpha `0.5`, accepted input immediately, and played entry 52 twice at pitches
2 and 3 for every `${level}:${offer.sequence}`. It had no PlayerActor-owned
level-up timer, BadGuys-73 sparkles, threshold light, or modal visibility state.
Consequently a real threshold looked like an ordinary modal appearing over a
fully populated frozen frame, and a multi-level award could replay the wrong
sound pair for each queued offer.

The native root cause is an ownership split. `LevelupScreen` owns the curtain,
panel reveal, offer, and input gate. The local PlayerActor independently owns
the one-shot threshold sound and 180-tick sparkle/light timer. The event which
identifies that transition in the multiplayer Website is the host-authored
`levelUpBarrier.barrierId`; an offer sequence identifies only one choice inside
that transition.

## Native causal trace

1. `0x0067C250` advances every crossed threshold, refills the local actor,
   queues the choices, fans out authored trigger type 13 through `0x0068BA90`,
   creates the screen through `0x0065F480`, and calls `0x005C88B0` once after
   the loop.
2. `0x005C88B0 -> 0x00528A20` writes float `180.0` to PlayerActor `+0x168`
   and requests sound-registry member `+0x908`, entry 52
   `sounds\levelup`, once at scalar `1.0` (`0x00528A3E`). Its only optional
   sibling, `0x0052A220`, is gated by equipment feature bits
   `+0x878 & 0x400` and owns the complete Mindblowing Ring burst documented in
   the equipment section below.
3. Player tick `0x00533520` enters while `+0x168 > 0`, subtracts one, and, when
   the actor is visible, creates one `Anim_Sparkle` (`0x00453980`) from exact
   BadGuys record 73. Starting from 180, this produces 180 births over 180
   ticks / 1.8 seconds with emitter values 179 through 0. Birth X is
   `RandomFloat(30, true)`. Birth Y is
   `-20 - RandomFloat(playerY - viewportTop, false)`, so the authored column
   spans from 20 units above the player to the current viewport top.
4. `Anim_Sparkle` starts with timer 180, decay 3, and a fixed random angle in
   `[0,360]`. Player tick adds `RandomFloat(2, false)` to decay. Particle tick
   subtracts that 3--5 decay and moves Y by `-0.1`, producing a 36--60 tick
   lifetime. Render scale is `sin(particleTimer degrees)`. Birth alpha remains
   `(1 - abs(x)/30) * sin(emitterTimer degrees) * 0.75`; no independent random
   alpha, lateral drift, angular velocity, or random base scale exists. The
   native calls consume five gameplay-RNG words per birth in order: unsigned Y
   magnitude, signed-X magnitude, signed-X sign, unsigned angle, then unsigned
   decay. Magnitudes use bound 100001 over closed endpoints and the primitive's
   intermediate float32 stores; the sign consumes its own second word. The
   Website keeps presentation randomness identity-local rather than consuming
   authoritative simulation RNG, but preserves that five-lane membership,
   native integer reduction, closed domains, sign draw, and float32 schedule.
5. Player light submission `0x005299A0` observes the same timer. The stored
   source keeps the normal heading-offset anchor, intensity 1, and flag 1;
   radius is `(actor[+0x268] + 1) * 2.6 + sin(timer degrees)`. The separate
   immediate-draw argument `2.6 - RandomFloat(0.2, false)` is not the stored
   region-light radius. With the Website's baseline phase lane at zero, the
   threshold effect changes the one ordinary player source from radius 2.6 to
   `2.6 + sin(timer degrees)`; it does not append a duplicate source. This
   light and the sparkle actor are not children of the picker screen.
6. `LevelupScreen` ctor `0x00658620` initializes reveal alpha `+0x100 = 0`
   and direction `+0x104 = +1`. Tick `0x0066F920` clamps
   `alpha + direction * 0.025`, producing a 40-tick / 0.4-second reveal.
   Apply `0x00671470` rejects input until alpha reaches 1.
7. Render `0x0067DF80` draws full-viewport black at
   `0.5 * revealAlpha`, the ring/arc ambient lane at
   `0.1 * revealAlpha`, and the panel/content lane at
   `revealAlpha^3`. Stable geometry remains the previously recovered picker
   contract.

Sound member `+0xB18` is entry 64 `sounds\openpanel`. Member `+0x11A0` is
entry 102 `sounds\unlockskill`, used when another queued choice is rebuilt.
Entry 53 `sounds\levelupskill` remains loaded but undispatched. Calls
`0x00647F6B/0x00647FBE` do use entry 52 at pitches 2 and 3, but their only
caller is Turn Undead `0x00647EF0`; instruction xrefs falsify their prior
level-transition attribution.

## Membership and dispositions

| Member | Native ownership | Website disposition |
| --- | --- | --- |
| Ordinary local threshold, one or many levels crossed | one `0x005C88B0` call after the threshold loop | one sound and one 1.8-second presentation keyed by barrier ID; queued offer sequences cannot rearm it |
| Three-choice and Creativity four-choice screens | same reveal and input gate | both use the 0.4-second alpha contract and remain mandatory |
| Queued choices in one threshold event | screen rebuild, `unlockskill`; no second PlayerActor threshold effect | update the offer inside the same presentation identity; no level sound/VFX replay |
| Forced action `0x0067C320` | screen with delay 10 and forced flag `+0x624`; no `0x005C88B0` | future forced-offer producers must open the picker without synthesizing a level transition |
| Non-local/bot progression | levels without local screen/effect | no browser-local presentation for an entity that does not own the client's offer |
| Shared multiplayer milestone | each cohort member owns a private offer; world barrier remains host-authored | each eligible local participant presents its barrier once; waiting and late-join observers do not replay it |
| Story authored LEVEL UP trigger type 13 | only Story 0 UIDs 57029/57098; action 1090 changes XP accumulation to 25/30 | separate authored-timeline backlog; never substitute those rows for presentation |
| Equipment feature `+0x878 & 0x400` | optional `0x0052A220` Mindblowing Ring burst | exact-ported as source-player level damage, retained VFX/audio, Shockwave Dazzle/push, and actor-manager light |

The six shipped `.boneyard` scripts were decoded completely for the trigger
sweep. Tutorial, Survival, Story 1, Sandbox, Play, and New Boneyard 1 contain
no other `LEVEL UP` presentation member.

## Modal visibility policy

Static recovery proves that `LevelupScreen_Render` draws a translucent curtain
over the already rendered world; it does not write an enemy-specific hidden
flag. The native actor-world pause holds non-player actors while PlayerActor
ticks continue, letting the local sparkle/light remain alive beneath the
screen. The stock witness and reported behavior require the browser modal not
to expose the frozen transient clutter that was visible in the pre-correction
web receipt.

The browser compatibility policy is therefore explicit: while the local skill
picker is active, keep static scenery, the local player, its level-up
sparkle/light, and the fixed HUD; suppress remote players, NPC actors, enemies,
enemy lightning/projectiles/death effects, maggots, primary spells, player
death bursts, and other dynamic spell/actor effects. This is a web renderer
presentation rule backed by the reported stock appearance, not a fabricated
native field write. Authority remains unchanged and the hidden samples
continue to be held by the existing shared barrier.

## Required regression and acceptance

Pure regressions must pin the 100 Hz timings, 40-tick reveal, curtain/ambient/
panel alpha lanes, 180-tick emission, exact 36--60-tick particle decay family,
five-lane closed-domain birth sampling, birth geometry, sine envelopes,
barrier-vs-offer identity, one scalar-1
entry-52 request, and forced/queued/no-replay
membership. Renderer contracts must prove that the local player/VFX remain
renderable while each suppressed dynamic family is absent, then all families
return after the final choice. The real Windows Chromium journey must cross an
ordinary gameplay threshold, observe the sound at playback rate 1, capture
early and settled reveal frames, show BadGuys-73 particles at the player,
hold an enemy/spell sample unchanged and invisible during the picker, reject
selection before 0.4 seconds, accept it afterward, and restore the held world
without page, console, or HTTP errors.
