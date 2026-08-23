# ML bot policy v6 selection receipt

Schema v6 is the equipped-spell semantic cutover. It replaces the ambiguous v5
loadout projection with one exact shared descriptor for the current primary,
all eight quickbar slots, and every offered skill. It also isolates choice PPO
from the combat trunk after the stopped v5 joint-optimizer trajectory proved
that overlapping Adam ownership regressed aim lead and potion use.

## Current selection state

- Candidate selection: pending fresh Mac bootstrap, learned-choice training,
  frozen arena screens, and paired 30-seed train-distribution plus 30-seed
  holdout evaluation.
- Production/deployed incumbent: unchanged schema-v5 checkpoint, SHA-256
  `bf9f21ee7d149a7f46a40265bd9a03659b255468e198fee614f54ebded136f8b`.
- Publication, production checkpoint replacement, and deployment: not
  authorized by this training pass.

No v6 candidate is selected merely because it trains, kills more enemies, or
reaches one high outlier wave. Promotion requires the frozen paired wave-depth
rule and no holdout regression, followed by the complete Mac gate and browser
GameHost acceptance.

## Required receipt fields

The final candidate receipt records source commit, checkpoint path/SHA-256 and
bytes, bootstrap and learned-choice imitation gates, behavior probes,
Python/TypeScript main-and-choice parity, cumulative authoritative ticks,
deaths, waves reached/completed, kills, potions, loot/orbs, choices by skill,
spell actions by equipped skill id, maximum observed equipped ranks, paired
confidence intervals, canonical validation, browser errors, and separate Git,
publication, production, and deployment states.
