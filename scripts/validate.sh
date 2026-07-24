#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

fail() {
    printf 'Validation error: %s\n' "$*" >&2
    exit 1
}

for command_name in python3 node npm; do
    command -v "$command_name" >/dev/null 2>&1 ||
        fail "$command_name is required"
done

mapfile -t required_versions < <(
    python3 - <<'PY'
import json
from pathlib import Path

root = Path.cwd()
dotnet = json.loads((root / "global.json").read_text())["sdk"]["version"]
frontend = json.loads((root / "frontend/package.json").read_text())
print(dotnet)
print(frontend["engines"]["node"])
print(frontend["engines"]["npm"])
PY
)

required_dotnet="${required_versions[0]}"
required_node="${required_versions[1]}"
required_npm="${required_versions[2]}"

dotnet_candidates=()
if [[ -n "${SDR_DOTNET:-}" ]]; then
    dotnet_candidates+=("$SDR_DOTNET")
fi
if command -v dotnet >/dev/null 2>&1; then
    dotnet_candidates+=("$(command -v dotnet)")
fi
if [[ -n "${DOTNET_ROOT:-}" && -x "$DOTNET_ROOT/dotnet" ]]; then
    dotnet_candidates+=("$DOTNET_ROOT/dotnet")
fi
if [[ -n "${HOME:-}" && -x "$HOME/.dotnet/dotnet" ]]; then
    dotnet_candidates+=("$HOME/.dotnet/dotnet")
fi

dotnet_command=""
for candidate in "${dotnet_candidates[@]}"; do
    if actual_version="$("$candidate" --version 2>/dev/null)" &&
        [[ "$actual_version" == "$required_dotnet" ]]; then
        dotnet_command="$candidate"
        break
    fi
done

if [[ -z "$dotnet_command" ]]; then
    fail ".NET SDK $required_dotnet is required; install it or set SDR_DOTNET to its dotnet host"
fi

actual_node="$(node --version)"
actual_node="${actual_node#v}"
[[ "$actual_node" == "$required_node" ]] ||
    fail "Node.js $required_node is required, found $actual_node"

actual_npm="$(npm --version)"
[[ "$actual_npm" == "$required_npm" ]] ||
    fail "npm $required_npm is required, found $actual_npm"

export SDR_DOTNET="$dotnet_command"

install_dependencies() {
    printf 'Restoring pinned dependencies\n'
    "$dotnet_command" restore backend/Server.csproj --nologo
    npm --prefix frontend ci --no-audit --no-fund
}

run_lint() {
    printf 'Checking backend formatting\n'
    "$dotnet_command" format backend/Server.csproj \
        --verify-no-changes \
        --no-restore \
        --verbosity minimal

    printf 'Checking frontend lint\n'
    npm --prefix frontend run lint
}

run_all() {
    printf 'Building backend\n'
    "$dotnet_command" build backend/Server.csproj \
        --configuration Release \
        --no-restore \
        --nologo \
        --verbosity minimal

    printf 'Running Website contracts and backend integration tests\n'
    python3 -m unittest discover -s tests -p 'test_*.py' -v

    run_lint

    printf 'Running frontend tests\n'
    npm --prefix frontend run test:boneyard

    printf 'Building production frontend\n'
    npm --prefix frontend run build
}

mode="${1:-all}"
[[ "$#" -le 1 ]] || fail "usage: ./scripts/validate.sh [all|lint]"

case "$mode" in
    all)
        install_dependencies
        run_all
        ;;
    lint)
        install_dependencies
        run_lint
        ;;
    *)
        fail "usage: ./scripts/validate.sh [all|lint]"
        ;;
esac
