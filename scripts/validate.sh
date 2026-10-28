#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

fail() {
    printf 'Validation error: %s\n' "$*" >&2
    exit 1
}

python_command=python3
venv_python=.venv/bin/python
case "${OSTYPE:-}" in
    msys*|cygwin*) python_command=python; venv_python=.venv/Scripts/python.exe ;;
esac

for command_name in "$python_command" node npm; do
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

artifact_temp=""
cleanup_artifact() {
    if [[ -n "$artifact_temp" ]]; then
        rm -rf -- "$artifact_temp"
    fi
}
trap cleanup_artifact EXIT

prepare_game_artifact() {
    if [[ -z "${SDR_GAME_DIST:-}" && -z "${SDR_GAME_NATIVE_HOST:-}" ]]; then
        artifact_temp="$(mktemp -d "${TMPDIR:-/tmp}/solomon-website-artifact.XXXXXX")"
        "$python_command" tools/fetch-game-artifact.py "$artifact_temp/artifact" >"$artifact_temp/receipt.json"
        SDR_GAME_DIST="$("$python_command" -c 'import json,sys; print(json.load(open(sys.argv[1]))["dist"])' "$artifact_temp/receipt.json")"
        SDR_GAME_NATIVE_HOST="$("$python_command" -c 'import json,sys; print(json.load(open(sys.argv[1]))["nativeHost"])' "$artifact_temp/receipt.json")"
        export SDR_GAME_DIST SDR_GAME_NATIVE_HOST
    fi
    node frontend/tools/game-artifact.mjs check
    mkdir -p frontend/reports
    node frontend/tools/game-artifact.mjs inspect >frontend/reports/game-artifact.json
}

install_dependencies() {
    printf 'Restoring pinned dependencies\n'
    "$dotnet_command" restore backend/Server.csproj --nologo
    npm --prefix frontend ci --no-audit --no-fund
    "$python_command" -m venv .venv
    "$venv_python" -m pip install --disable-pip-version-check --requirement tests/requirements.txt
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
    "$venv_python" -m unittest discover -s tests -p 'test_*.py' -v

    run_lint

    printf 'Running frontend tests\n'
    npm --prefix frontend test

    for suite in web-lua hagatha harden loot arena-render boneyard portal cheat-menu hud-skill-selector world-weather parties level-up native-ui tutorial diagnostics hall hub-ui; do
        npm --prefix frontend run "test:$suite"
    done

    printf 'Building production frontend\n'
    npm --prefix frontend run build

    printf 'Checking production media policy\n'
    node frontend/tools/check-production-media-policy.mjs

    printf 'Measuring restored PixiJS renderer quality gates\n'
    npm --prefix frontend run quality:renderer

    printf 'Rust runtime and desktop gates remain owned by the matched released artifact.\n'
}

mode="${1:-all}"
[[ "$#" -le 1 ]] || fail "usage: ./scripts/validate.sh [all|lint]"

case "$mode" in
    all)
        prepare_game_artifact
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
