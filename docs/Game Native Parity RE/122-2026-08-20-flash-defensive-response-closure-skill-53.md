# 2026-08-20 — Flash defensive-response closure (skill 53)

## Reopened ownership thread

The older Earth/Arcane branch treated Flash as an attacker-only Dazzle plus a
sound counter. A full trace of Player vslot `+0x4C` (`0x0052F540`), the branch
at `0x00530768..0x00530807`, and response helper `0x00649890` disproves that
model. Flash is a defender-rooted area response with gameplay, audio, Region,
camera-displacement, and twelve independent animation owners.

## Exact native contract

- Flash is evaluated before Deflect, Stoneskin, resistance, Harden, and Magic
  Shield. A positive incoming contact executes
  `d=Integer(100); d>0 && d<=round(mChance)`. Roll zero fails.
- Success consumes `Float(.2)` for `flashspell` playback rate `1+draw`, one
  100001-way unit-vector draw for Region displacement, then eight `Float(1)`
  child-scale draws. Those ten response words precede any later Deflect RNG.
- `0x00649890 -> 0x00642280` queries native mask/group `2` with dimension 200;
  the query helper halves it to an exact radius 100. Every returned hostile
  receives max-merged `Mod_Dazzle (0x1B6E)` for
  `round(mDuration*100)` ticks. The effect is not restricted to the source
  attacker.
- Eight BadGuys-16 `Anim_FadeGrowAdditive_Perspective` children start at the
  defender root with independent scale `2-Float(1)`, alpha one, loss `.05`,
  and scale recurrence `*1.05`. Four BadGuys-15 `Anim_FadeAdditive` children
  start at defender Y minus 25, scale six, alpha one, and loss `.05`. All 12
  are world-owned 20-tick actors.
- The response writes a white point-attenuated Region flash with loss `.05`.
  Its random displacement has magnitude three, decays by float32 `.75` each
  Region tick, and clears when squared length reaches `.25`.
- Registry offset `0x61C` is `sounds\\flashspell`. The checked-in stock WAV is
  SHA-256 `fda25c45eab0290011b1f3ba859757578586b30c3e7f1c905077f801af0ee5be`.

## Web consequence and validation

The dense skill runtime resolves row-53 chance/duration from the actor-private
effective book. The harmful-contact seam consumes the chance and complete
response RNG before Deflect, then materializes one semantic response event,
12 independently replicated actors, and target-owned area Dazzle. Protocol 36
strictly carries skill-53 actors plus the response's displacement, screen
flash, randomized pitch, and retained event identity. Hub and Boneyard apply
the same decaying displacement to their active world root; the resident audio
synchronizer consumes `flash-spell` once without hydration replay.

Focused coverage pins percentile zero, successful chance, all 14 RNG words in
a combined Flash-plus-Deflect case, radius membership, Dazzle merge, 8+4 actor
construction and recurrence, records 15/16, Region decay, strict protocol,
stock PCM, event audio, and a live Boneyard damaging contact. No Flash branch
or presentation child remains inferred.
