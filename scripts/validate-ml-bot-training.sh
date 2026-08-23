#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
training_python="${ML_BOT_PYTHON:-python3}"

"$training_python" - <<'PY'
import sys
import numpy
import torch

if sys.version_info[:2] != (3, 12):
    raise SystemExit(f"Python 3.12 is required, found {sys.version.split()[0]}")
if numpy.__version__ != "2.5.2":
    raise SystemExit(f"NumPy 2.5.2 is required, found {numpy.__version__}")
if str(torch.__version__) != "2.13.0":
    raise SystemExit(f"PyTorch 2.13.0 is required, found {torch.__version__}")
PY

cd "$repo_root"
"$training_python" tools/train_bot_policy.py self-test
