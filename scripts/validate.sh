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
    if "$candidate" --version >/dev/null 2>&1; then
        dotnet_command="$candidate"
        break
    fi
done

if [[ -z "$dotnet_command" ]]; then
    fail ".NET SDK is required; install it or set SDR_DOTNET to its dotnet host"
fi

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
    npm --prefix frontend run test:web-lua
    npm --prefix frontend run test:hagatha
    npm --prefix frontend run test:harden
    npm --prefix frontend run test:loot
    npm --prefix frontend run test:arena-render
    npm --prefix frontend run test:boneyard
    npm --prefix frontend run test:portal
    npm --prefix frontend run test:cheat-menu
    npm --prefix frontend run test:hud-skill-selector
    npm --prefix frontend run test:world-weather
    npm --prefix frontend run test:parties
    npm --prefix frontend run test:level-up
    npm --prefix frontend run test:native-ui
    npm --prefix frontend run test:tutorial
    npm --prefix frontend run test:diagnostics
    npm --prefix frontend run test:hall
    npm --prefix frontend run test:hub-ui

    printf 'Running desktop shell tests\n'
    npm --prefix frontend run test:desktop

    printf 'Building production frontend\n'
    npm --prefix frontend run build

    printf 'Checking production media policy\n'
    node frontend/tools/check-production-media-policy.mjs

    printf 'Measuring renderer quality gates\n'
    npm --prefix frontend run quality:renderer
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
