# ML bot policy v5 selection receipt

The first corrected Web Port campaign was trained on Mac from source commit
`6db12a72ee44dd5f685fafc31dca34c204baa779`. The selected checkpoint is now a
server-only GameHost asset; training remains frozen and separate from runtime
integration.

## Selected checkpoint

- Kind: class-balanced semantic-expert behavioral-cloning bootstrap.
- Format: strict `SDMLV5`.
- SHA-256: `bf9f21ee7d149a7f46a40265bd9a03659b255468e198fee614f54ebded136f8b`.
- Bytes: 4,446,642.
- Mac artifact package:
  `/Users/jarrett/codex-acceptance/solomon-dark-ml-bot-policy-v5-selected-20260823`.
- Python/TypeScript validation: identical action and value; composite
  log-probability absolute error `2.211404361851521e-7`.

The bootstrap passes every fixed representation probe: combat target `1.0`,
combat cast `0.9971`, no-target idle `1.0`, aim lead `0.9067`, hazard exit
`0.7619`, and potion use `0.75` over 16 expert potion rows.

## Live GameHost integration receipt

The deterministic Mac integration smoke uses allowed run seed `518852612`, a
real developer Lua summon, the normal three-second party invitation, the
authored moving entry gate, Solomon's complete encounter sequence, and the
selected worker checkpoint. Its first passing sample traveled `1,376.398`
world units, made `25` learned decisions, killed `4` opening enemies, used one
potion, retained one inventory item, remained alive, and had not yet reached a
numbered wave. This is an integration liveness receipt, not a replacement for
the frozen 30-episode evaluation below.

## Frozen evaluation

Both sets used 30 deterministic episodes, a 3,000-decision ceiling, ten
authoritative ticks per decision, and ended with 30 real deaths and zero
truncations.

| Set | Mean waves reached (bootstrap 95% CI) | Mean return (bootstrap 95% CI) | Kills | Waves completed | Potions | Skill picks | Gold | Items | Health / mana orbs | Powerups |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train distribution | 1.100 (0.966–1.267) | 16.527 (11.664–22.882) | 636 | 4 | 29 | 41 | 18 | 0 | 3 / 12 | 0 |
| Holdout | 0.967 (0.800–1.133) | 14.149 (10.478–19.721) | 563 | 2 | 29 | 36 | 13 | 0 | 1 / 5 | 0 |

## PPO screening decision

Ten PPO updates were trained over 409,384 authoritative ticks. The campaign
produced 3,022 kills, 49 completed waves, 88 potions, 143 scripted skill
picks, 178 gold, three items, 22 health orbs, 91 mana orbs, and one powerup.
Every checkpoint retained the fixed behavior-probe pass.

No PPO checkpoint met the frozen promotion rule. The five full-scale
train-distribution challengers were:

| Checkpoint | Mean waves reached | Paired mean difference | Paired 95% interval | Kills | Waves completed | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Update 3 | 1.133 | +0.033 | −0.299 to +0.365 | 702 | 8 | no CI-backed win |
| Update 5 | 1.067 | −0.033 | −0.352 to +0.285 | 721 | 7 | no CI-backed win |
| Update 6 | 1.000 | −0.100 | −0.337 to +0.137 | 633 | 5 | no CI-backed win |
| Update 7 | 1.033 | −0.067 | −0.314 to +0.181 | 674 | 6 | no CI-backed win |
| Update 8 | 1.067 | −0.033 | −0.415 to +0.348 | 765 | 9 | no CI-backed win |

The incumbent bootstrap was therefore retained. Higher kill or completed-wave
totals do not override the pre-registered paired waves-reached rule.

## Closed findings

1. The initial headless implementation nulled the arena transition while
   starting waves, leaving participants at the outside entrance spawn behind
   the fence. Seed `1592594436` stopped progressing after decision 414. The
   corrected reset stages every participant collision-safe around Solomon's
   encounter anchor inside production combat bounds and retains the production
   arena transition. The same expert seed then reached 72 kills, two waves,
   and a real death at decision 793.
2. Uniform behavioral cloning hid rare-action failure behind 99.58% aggregate
   ability accuracy: only 43.75% of potion rows were imitated. Per-head
   square-root inverse-frequency weighting raised potion imitation to 75%, and
   bootstrap now fails closed below eight potion rows or 70% accuracy.

Runtime integration preserves bots as ordinary replicated game participants.
The developer-only Lua summon is Hub-bound and repeatable, party acceptance
uses the real invitation after three seconds, and the live adapter handles the
authored Boneyard entrance before checkpoint control begins. Bot presence does
not keep an otherwise human-empty server alive.
