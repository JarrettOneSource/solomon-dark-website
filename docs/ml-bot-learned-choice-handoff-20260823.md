# ML bot learned-choice handoff — 2026-08-23

> **Superseded on 2026-08-24:** the schema-v5 continuation below is historical.
> Schema v7 now covers all five pure primaries, ten Welds, continuous casting,
> exact future-safe identities, and learned choices. No trainer from this
> handoff is live. Continue from
> [`ml-bot-policy-v7-selection.md`](ml-bot-policy-v7-selection.md) and validated
> local commit `9477c332c93b49a8fceb54ccffc73ca01cb95d41`; production remains unchanged.

This is the restart point for the extended schema-v5 bot-training campaign.
All execution, tests, training, and evaluation must stay on the Mac Mini. Do
not run any of them on the Linux/WSL workstation. The production GameHost and
its selected checkpoint are intentionally unchanged while candidates train.

## Exact source

- Base/public commit: `163caeac3a8d7e77aceb5ba87c3193ce933eab45`.
- Learned-choice implementation commit:
  `ffab2bff482bbc5452c41b7ce3fbb7c186372d89`.
- Branch: `codex/ml-bot-learned-choice-20260823-root`.
- Mac handoff checkout:
  `/Users/jarrett/codex-acceptance/ml-bot-learned-choice-handoff-20260823/repo`.
- Mac Git bundle:
  `/Users/jarrett/codex-acceptance/ml-bot-learned-choice-handoff-20260823/ml-bot-learned-choice.bundle`.
- Mac snapshot used by the currently running choice collector:
  `/Users/jarrett/codex-acceptance/ml-bot-learned-choice-20260823/website`.
- Pinned Python environment:
  `/Users/jarrett/codex-acceptance/ml-bot-training-f12db3b6/venv/bin/python`.

The handoff directory contains `HEAD.txt` and `STATUS.json` with the final
handoff commit and a point-in-time process receipt. The Git checkout is the
canonical source for continuation; the older snapshot remains in place so the
already-running collector never changes underneath itself.

## Production incumbent — do not replace yet

- Public/deployed Website commit:
  `163caeac3a8d7e77aceb5ba87c3193ce933eab45`.
- Selected checkpoint SHA-256:
  `bf9f21ee7d149a7f46a40265bd9a03659b255468e198fee614f54ebded136f8b`.
- Selected checkpoint bytes: `4,446,642`.
- The incumbent retains scripted skill selection because its metadata has no
  learned-choice marker.
- Promotion still requires complete paired 30-seed train-distribution and
  30-seed holdout reports with the frozen confidence rule. A higher raw kill
  or wave total alone is not authorization to deploy.

## Running Mac jobs

### 1. Extended combat PPO through update 100

- PID file:
  `/Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/campaign-02/extended-update100.pid`.
- Log:
  `/Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/campaign-02/extended-update100.log`.
- Checkpoints/trainer state:
  `/Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/campaign-02`.
- Requested continuation: update 11 through update 100, eight worlds/eight
  workers, 512 decisions per update, ten simulation ticks per decision,
  gamma `0.995`, GAE `0.95`, learning rate `0.0001`, four PPO epochs, target
  KL `0.02`.
- Snapshot receipt: update 33, `1,350,769` total environment ticks, 193
  completed episodes. Across updates 1–33: 9,257 enemies killed, 134 waves
  completed, 331 potions, 500 scripted skill picks, 471 gold, 9 items, 73
  health orbs, 234 mana orbs, and 1 powerup.
- Latest update 33: 345 kills (306 skeletons, 37 archers, 2 imps), 2 waves,
  9 potions, 17 skill picks, 40 gold, 4 mana orbs, wave-depth mean `1.167`,
  max `2`.

Check it without disturbing it:

```sh
campaign=/Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/campaign-02
pid=$(cat "$campaign/extended-update100.pid")
ps -p "$pid" -o pid=,etime=,%cpu=,%mem=,state=,command=
tail -n 5 "$campaign/extended-update100.log"
```

### 2. Authoritative choice-offer collection and incumbent warm start

- PID file:
  `/Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/choice-bootstrap-incumbent/bootstrap.pid`.
- Log:
  `/Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/choice-bootstrap-incumbent/bootstrap.log`.
- Output directory:
  `/Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/choice-bootstrap-incumbent`.
- Requested dataset: 512 real scripted skill offers, two worlds/two workers,
  ten ticks per expert decision. After collection it runs 40 supervised epochs
  over the choice scorer only.
- Snapshot receipt: 16/512 real offers collected after 5,118 authoritative
  decisions. The Node child was actively consuming about 1.8 CPU cores; this
  is sparse progress, not an idle spot.
- Expected outputs after completion: `choice-expert-v5.npz`,
  `choice-bootstrap-v5.sdml`, `latest.sdml`, and
  `choice-bootstrap-report.json`.

Check it without disturbing it:

```sh
choice=/Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/choice-bootstrap-incumbent
pid=$(cat "$choice/bootstrap.pid")
ps -p "$pid" -o pid=,etime=,%cpu=,%mem=,state=,command=
pgrep -P "$pid" | xargs -n1 ps -o pid=,ppid=,etime=,%cpu=,state= -p
tail -n 20 "$choice/bootstrap.log"
```

## Implemented learned-choice path

- A learned headless environment stops at a real pending offer, exposes the
  1,784-value observation plus variable 56-value option rows/IDs/mask, applies
  an externally evaluated choice without advancing time, and opens exact SMDP
  credit through the next offer or terminal state.
- Choice plans/selections cross batches, worker threads, and the strict
  `solomon-dark-ml-rollout-v5-choice1` NDJSON bridge.
- Python samples choices before the next main action during training and uses
  deterministic argmax during evaluation. Scripted checkpoints remain a fair
  scripted baseline.
- `bootstrap-choices` collects authoritative scripted labels and trains only
  `choice_hidden`/`choice_score`; every trunk, combat, and value tensor is
  protected by an exact equality gate.
- Learned SMDP intervals now reach the existing choice PPO optimizer and report
  selected skill IDs/families. Episode and evaluation reports record chosen
  skill IDs, choice mode, kills, waves, potions, gold/items, and orbs.
- A checkpoint marked `choicePolicyMode=learned` uses the same choice head in
  the live GameHost worker and dispatches the ordinary player skill-selection
  intent. The controller suppresses duplicate async dispatches for the same
  offer generation.
- Python/TypeScript validation now compares both main inference and masked
  choice inference.

## Mac validation completed

- Latest focused TypeScript/host gate:
  `npm run test:ml-bot` — 64/64 passed after the duplicate-generation guard.
- Pinned Python `self-test` passed.
- Selected-checkpoint Python/TypeScript parity passed:
  main log-probability absolute error `2.211404361851521e-7`; choice selected
  option `1`, choice log-probability absolute error
  `2.695330245661154e-7`; both value errors `0`.
- `git diff --check` passed before the implementation commit.
- The full canonical `./scripts/validate.sh`, combined learned-choice campaign,
  arena screens, frozen 30+30 evaluation, browser acceptance, publication,
  and deployment have not yet been run for this branch.

## Continuation sequence

1. Keep both current jobs alive and verify their PIDs, CPU time, log growth,
   update/event counts, and artifact mtimes periodically.
2. When combat update 100 completes, summarize it and arena-screen the
   incumbent plus updates 10, 20, …, 100 on identical seeds. Do not select by
   the training rollup alone.
3. When the 512-offer job completes, inspect its diversity and imitation gates.
   Reuse its immutable `choice-expert-v5.npz` to warm-start the best combat
   finalist, so the combined candidate starts with both the strongest combat
   tensors and a non-random skill head:

   ```sh
   cd /Users/jarrett/codex-acceptance/ml-bot-learned-choice-handoff-20260823/repo
   python=/Users/jarrett/codex-acceptance/ml-bot-training-f12db3b6/venv/bin/python
   "$python" tools/train_bot_policy.py bootstrap-choices \
     --checkpoint /absolute/path/to/chosen-combat-finalist.sdml \
     --dataset /Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/choice-bootstrap-incumbent/choice-expert-v5.npz \
     --output /Users/jarrett/codex-acceptance/ml-bot-training-6db12a72/choice-bootstrap-finalist \
     --samples 512 --epochs 40 --batch-size 64 --learning-rate 0.001 \
     --validation-fraction 0.2 --worlds 8 --workers 8 \
     --action-repeat 10 --seed 0x5eed2000
   ```

4. Start a fresh, long combined PPO campaign from that learned-choice
   checkpoint. Because its metadata says `choicePolicyMode=learned`, the
   trainer will automatically collect trainable SMDP intervals. Preserve the
   existing main hyperparameters initially; register the experiment and use a
   separate output directory/trainer state.
5. At each checkpoint screen, report kills, waves completed/reached, deaths,
   potions, chosen skill IDs/families, gold/items, health/mana orbs, powerups,
   KL, choice entropy/loss, and whether simulation ticks continue advancing.
6. Run the full 30+30 frozen evaluation only for credible finalists. Compare
   the learned candidate against the deployed scripted incumbent with the
   existing `promote` command.
7. Only after a CI-backed promotion: package the winning checkpoint, run the
   full Mac canonical gate and live/browser acceptance, update the selection
   receipt, fast-forward main, push, upload the checkpoint, deploy, and verify
   public Git SHA separately from production artifact SHA.

## Safety and ownership reminders

- Do not run tests or training off the Mac Mini.
- Do not overwrite the deployed checkpoint while these candidates are
  unproven.
- Do not infer progress from CPU alone: confirm update/event counts and
  authoritative ticks.
- Bots are normal participants. They do not count as humans for liveness and
  do not keep an otherwise human-empty server open.
- The developer entitlement and bot summon behavior already deployed on main
  are not part of this unfinished promotion.
