#!/usr/bin/env bash
set -Eeuo pipefail

umask 077
export GIT_TERMINAL_PROMPT=0

repository_url="${SDR_DEPLOY_REPOSITORY_URL:-https://github.com/JarrettOneSource/solomon-dark-website.git}"
remote_host="${SDR_DEPLOY_REMOTE_HOST:-root@192.223.26.98}"
ssh_command="${SDR_DEPLOY_SSH_COMMAND:-/usr/bin/ssh}"
scp_command="${SDR_DEPLOY_SCP_COMMAND:-/usr/bin/scp}"
ssh_identity="${SDR_DEPLOY_SSH_IDENTITY:-$HOME/.ssh/id_ed25519_nfoservers_root}"
public_url="${SDR_DEPLOY_PUBLIC_URL:-https://solomondarker.com}"
ci_root="${SDR_DEPLOY_ROOT:-/Volumes/Drive/solomon-cicd}"
if [[ "${SDR_DEPLOY_LOCK_HELD:-}" != 1 ]]; then
    exec /usr/bin/python3 "$(dirname -- "$0")/run-worker.py" --root "$ci_root"
fi
caddy_source_path="ops/nfo/solomon-dark-revived.caddy"
game_unit_names=(solomon-dark-game.service solomon-dark-rust-game.service solomon-dark-rust-api.service)
remote_caddy_site="/etc/caddy/sites/solomon-dark-revived.caddy"
ssh_options=(
    -o BatchMode=yes
    -o ConnectTimeout=15
    -o IdentitiesOnly=yes
    -o StrictHostKeyChecking=yes
    -o "UserKnownHostsFile=$ci_root/credentials/known_hosts"
    -o "HostKeyAlias=${SDR_DEPLOY_HOST_KEY_ALIAS:-fleet-nfo-server}"
    -i "$ssh_identity"
)

data_root="$ci_root/data"
state_root="$ci_root/state"
mirror="$data_root/repository.git"
run_parent="$data_root/runs"
artifact_root="$ci_root/artifacts"
failed_target_file="$state_root/failed-target"

run_root=""
source_checkout=""
worktree_registered=0
artifact_temp=""
checksum_temp=""
failed_target_temp=""
remote_upload=""
worker_temp=""

log() {
    printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

fail() {
    log "Deployment error: $*" >&2
    exit 1
}

cleanup() {
    local exit_code=$?

    if [[ -n "$remote_upload" ]]; then
        "$ssh_command" "${ssh_options[@]}" "$remote_host" \
            "test ! -f '$remote_upload' || unlink -- '$remote_upload'" \
            >/dev/null 2>&1 || true
    fi

    if [[ -n "$artifact_temp" && -f "$artifact_temp" ]]; then
        unlink -- "$artifact_temp"
    fi
    if [[ -n "$checksum_temp" && -f "$checksum_temp" ]]; then
        unlink -- "$checksum_temp"
    fi
    if [[ -n "$failed_target_temp" && -f "$failed_target_temp" ]]; then
        unlink -- "$failed_target_temp"
    fi
    if [[ -n "$worker_temp" && -d "$worker_temp" ]]; then
        rm -rf -- "$worker_temp"
    fi
    if (( worktree_registered == 1 )); then
        git --git-dir="$mirror" worktree remove --force "$source_checkout" \
            >/dev/null 2>&1 || true
        git --git-dir="$mirror" worktree prune >/dev/null 2>&1 || true
    fi

    if [[ -n "$run_root" && -d "$run_root" ]]; then
        python3 - "$run_root" "$run_parent" <<'PY_CLEAN'
from pathlib import Path
import shutil, sys
p, parent = map(Path, sys.argv[1:])
if p.parent != parent or p.is_symlink():
    raise SystemExit("refusing unowned run cleanup")
shutil.rmtree(p)
PY_CLEAN
    fi

    exit "$exit_code"
}
trap cleanup EXIT

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

fetch_main() {
    git --git-dir="$mirror" -c credential.helper= fetch --quiet --prune --no-tags origin \
        +refs/heads/main:refs/remotes/origin/main
    git --git-dir="$mirror" rev-parse refs/remotes/origin/main
}

remote_deployed_sha() {
    "$ssh_command" "${ssh_options[@]}" "$remote_host" \
        "test -r /opt/solomon-dark-revived/DEPLOYED_GIT_SHA && tr -d '\\r\\n' </opt/solomon-dark-revived/DEPLOYED_GIT_SHA"
}

remote_caddy_checksum() {
    "$ssh_command" "${ssh_options[@]}" "$remote_host" \
        "if test -r '$remote_caddy_site'; then sha256sum '$remote_caddy_site' | awk '{print \$1}'; else printf 'missing\n'; fi"
}


remote_publication_ready() {
    "$ssh_command" "${ssh_options[@]}" "$remote_host" \
        "python3 - parallel-ready /opt/solomon-dark-revived '$target_sha' '$target_game_revision'" \
        <"$source_checkout/ops/local-ci/deployment-publication.py"
}

remote_game_artifact_checksum() {
    "$ssh_command" "${ssh_options[@]}" "$remote_host" \
        "if test -r /opt/solomon-dark-revived/game-source-artifact.json; then sha256sum /opt/solomon-dark-revived/game-source-artifact.json | awk '{print \$1}'; else printf 'missing\n'; fi"
}

remote_game_unit_checksum() {
    "$ssh_command" "${ssh_options[@]}" "$remote_host" \
        "cat /etc/systemd/system/solomon-dark-game.service /etc/systemd/system/solomon-dark-rust-game.service /etc/systemd/system/solomon-dark-rust-api.service 2>/dev/null | sha256sum | awk '{print \$1}'"
}

discard_artifact() {
    [[ ! -f "$artifact" ]] || unlink -- "$artifact"
    [[ ! -f "$checksum_file" ]] || unlink -- "$checksum_file"
}

record_failed_target() {
    failed_target_temp="$state_root/.failed-target.$$"
    printf '%s %s %s\n' "$target_sha" "$target_game_checksum" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$failed_target_temp"
    mv -- "$failed_target_temp" "$failed_target_file"
    failed_target_temp=""
}

sha_file() {
    python3 - "$1" <<'PY_HASH'
import hashlib, sys
with open(sys.argv[1], 'rb') as source:
    digest = hashlib.file_digest(source, 'sha256')
print(digest.hexdigest())
PY_HASH
}

sha_stream() {
    python3 -c 'import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())'
}

install_file() {
    mkdir -p -- "$(dirname -- "$3")"
    install -m "$1" -- "$2" "$3"
}

install_validated_worker() {
    worker_temp="$(mktemp -d "$state_root/worker.XXXXXXXX")"
    tar -xzf "$artifact" -C "$worker_temp" ./Deploy/M5Worker || fail "validated worker extraction failed"
    for name in deploy-main.sh run-worker.py install.py deployment-publication.py deploy-runtime.sh parallel-game-saves.py check-linux-artifact.py; do
        [[ -f "$worker_temp/Deploy/M5Worker/$name" ]] || fail "validated worker lacks $name"
    done
    # The admitted installer owns its new version's definition, not the older running code.
    result="$(python3 "$worker_temp/Deploy/M5Worker/install.py" --root "$ci_root" \
        --source "$worker_temp/Deploy/M5Worker" --no-bootstrap)" || fail "validated worker installation failed"
    rm -rf -- "$worker_temp" || fail "validated worker staging cleanup failed"
    worker_temp=""
    worker_changed="$(python3 -c 'import json,sys; print("changed" if json.loads(sys.argv[1])["components_changed"] else "unchanged")' "$result")" || fail "invalid worker installation receipt"
    [[ "$worker_changed" != changed ]] || return 0
    return 3
}

for command_name in curl date git install mktemp node npm python3 tar; do
    require_command "$command_name"
done
[[ -x "$ssh_command" ]] || fail "SSH client is not executable: $ssh_command"
[[ -x "$scp_command" ]] || fail "SCP client is not executable: $scp_command"
[[ -r "$ssh_identity" ]] || fail "SSH identity is not readable: $ssh_identity"

mkdir -p -- "$data_root" "$state_root" "$run_parent" "$artifact_root"

if [[ ! -d "$mirror/objects" ]]; then
    log "Creating the isolated main mirror"
    git init --quiet --bare "$mirror"
    git --git-dir="$mirror" remote add origin "$repository_url"
else
    git --git-dir="$mirror" remote set-url origin "$repository_url"
fi

target_sha="$(fetch_main)"
# Bootstrap cannot replace this Mac launcher with an older Linux-only release.
if ! git --git-dir="$mirror" cat-file -e "$target_sha:ops/local-ci/run-worker.py" 2>/dev/null; then
    log "origin/main $target_sha predates the M5 worker; waiting for the validated migration commit"
    exit 0
fi
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]] || fail "origin/main did not resolve to a commit"
target_caddy_checksum="$(
    git --git-dir="$mirror" show "$target_sha:$caddy_source_path" |
        sha_stream
)"
[[ "$target_caddy_checksum" =~ ^[0-9a-f]{64}$ ]] ||
    fail "origin/main did not contain a valid Caddy site configuration"
target_game_unit_checksum="$(
    for name in "${game_unit_names[@]}"; do
        git --git-dir="$mirror" show "$target_sha:ops/nfo/$name"
    done | sha_stream
)"
[[ "$target_game_unit_checksum" =~ ^[0-9a-f]{64}$ ]] ||
    fail "origin/main did not contain a valid game systemd unit"
short_sha="${target_sha:0:12}"
run_root="$(mktemp -d "$run_parent/run.XXXXXXXX")"
source_checkout="$run_root/source"
git --git-dir="$mirror" worktree add --quiet --detach "$source_checkout" "$target_sha"
worktree_registered=1

node_version="$(tr -d '[:space:]' <"$source_checkout/.node-version")"
[[ "$(node --version)" == "v$node_version" ]] || fail "CI Node version differs from the admitted source"
if [[ -z "${SDR_GAME_DIST:-}" && -z "${SDR_GAME_NATIVE_HOST:-}" ]]; then
    python3 "$source_checkout/tools/fetch-game-artifact.py" "$run_root/game" >"$run_root/game-download.json"
    SDR_GAME_DIST="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["dist"])' "$run_root/game-download.json")"
    SDR_GAME_NATIVE_HOST="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["nativeHost"])' "$run_root/game-download.json")"
fi
export SDR_GAME_DIST SDR_GAME_NATIVE_HOST
node "$source_checkout/frontend/tools/game-artifact.mjs" inspect >"$run_root/game-artifact.json"
SDR_GAME_DIST="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["dist"])' "$run_root/game-artifact.json")"
SDR_GAME_NATIVE_HOST="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["nativeHost"])' "$run_root/game-artifact.json")"
target_game_revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["revision"])' "$run_root/game-artifact.json")"
target_game_checksum="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["manifestSha256"])' "$run_root/game-artifact.json")"
[[ "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["target"])' "$run_root/game-artifact.json")" == x86_64-unknown-linux-gnu ]] ||
    fail "NFO requires the matching x86_64-unknown-linux-gnu Rust artifact"
artifact="$artifact_root/$target_sha-$target_game_checksum.tar.gz"
checksum_file="$artifact.sha256"
# Only the current main target can be reused; preserve unrelated files in this directory.
for cached in "$artifact_root"/*; do
    [[ -f "$cached" && ! -L "$cached" ]] || continue
    cached_name="${cached##*/}"
    [[ "$cached_name" =~ ^[0-9a-f]{40}(-[0-9a-f]{64})?\.tar\.gz(\.sha256)?$ ]] || continue
    [[ "$cached" == "$artifact" || "$cached" == "$checksum_file" ]] || unlink -- "$cached"
done

deployed_sha="$(remote_deployed_sha)"
live_caddy_checksum="$(remote_caddy_checksum)"
live_game_unit_checksum="$(remote_game_unit_checksum)"
live_game_checksum="$(remote_game_artifact_checksum)"
if [[ "$deployed_sha" == "$target_sha" &&
    "$live_caddy_checksum" == "$target_caddy_checksum" &&
    "$live_game_unit_checksum" == "$target_game_unit_checksum" &&
    "$live_game_checksum" == "$target_game_checksum" ]] && remote_publication_ready; then
    discard_artifact
    [[ ! -f "$failed_target_file" ]] || unlink -- "$failed_target_file"
    log "Production is already at origin/main $target_sha"
    exit 0
fi
if [[ "$deployed_sha" == "$target_sha" ]]; then
    log "Production runtime is current but its service configuration drifted"
fi
if [[ -f "$failed_target_file" ]]; then
    read -r failed_target_sha failed_game_checksum _ <"$failed_target_file"
    [[ "$failed_target_sha" =~ ^[0-9a-f]{40}$ ]] ||
        fail "failed deployment target state is invalid"
    if [[ "$failed_target_sha" == "$target_sha" && "$failed_game_checksum" == "$target_game_checksum" ]]; then
        log "Automatic deployment is suppressed for failed target $target_sha; run ops/local-ci/install.sh from a corrected checkout to retry"
        exit 0
    fi
fi

artifact_checksum=""
if [[ -f "$artifact" && -f "$checksum_file" ]]; then
    read -r artifact_checksum <"$checksum_file"
    if [[ ! "$artifact_checksum" =~ ^[0-9a-f]{64}$ ]] ||
        ! [[ "$(sha_file "$artifact")" == "$artifact_checksum" ]]; then
        log "Discarding an invalid cached artifact for $target_sha"
        discard_artifact
        artifact_checksum=""
    fi
fi

if [[ -z "$artifact_checksum" ]]; then
    log "Validating origin/main $target_sha"
    (
        cd "$source_checkout"
        SDR_BUILD_REVISION="$target_sha" ./scripts/validate.sh
    )

    git -C "$source_checkout" diff --exit-code
    git -C "$source_checkout" diff --cached --exit-code
    [[ "$(git -C "$source_checkout" write-tree)" == "$(git --git-dir="$mirror" rev-parse "$target_sha^{tree}")" ]] || fail "validated source index changed"

    newest_sha="$(fetch_main)"
    if [[ "$newest_sha" != "$target_sha" ]]; then
        log "Validated $target_sha was superseded by $newest_sha; deferring to the next run"
        exit 0
    fi

    publish_dir="$source_checkout/.deploy-publish"
    log "Publishing release $target_sha"
    "$SDR_DOTNET" restore "$source_checkout/backend/Server.csproj" --runtime linux-x64 -p:UseAppHost=false --nologo
    "$SDR_DOTNET" publish "$source_checkout/backend/Server.csproj" \
        --configuration Release \
        --no-restore \
        --runtime linux-x64 \
        --self-contained false \
        -p:UseAppHost=false \
        --output "$publish_dir" \
        --nologo \
        --verbosity minimal
    printf '%s\n' "$target_sha" >"$publish_dir/DEPLOYED_GIT_SHA"
    install_file 0755 "$SDR_GAME_NATIVE_HOST" "$publish_dir/GameHost/solomon-darker"
    install_file 0644 "$source_checkout/frontend/reports/game-artifact.json" "$publish_dir/game-artifact.json"
    install_file 0644 "$source_checkout/frontend/reports/game-source-artifact.json" "$publish_dir/game-source-artifact.json"
    [[ "$(sha_file "$publish_dir/game-source-artifact.json")" == "$target_game_checksum" ]] ||
        fail "Rust artifact changed during Website validation"
    printf 'SDR_GAME_REVISION=%s\nSDR_GAME_ASSET_DIRECTORY=/opt/solomon-dark-revived/wwwroot/game-rust\nSDR_GAME_SUPERVISOR_PORT=5232\nSDR_GAME_ML_BOT_CHECKPOINT=/opt/solomon-dark-revived/wwwroot/game-rust/assets/native/ml-bot-policy-v7-selected.sdml\n' \
        "$target_game_revision" >"$publish_dir/GameHost/release.env"
    printf 'SDR_GAME_ML_BOT_CHECKPOINT=/opt/solomon-dark-revived/GameHost/Pixi/ml-bot-policy-v7-selected.sdml\n' >"$publish_dir/GameHost/Pixi/release.env"
    printf 'GameSaves__Namespace=rust\nGameSessions__SupervisorUrl=http://127.0.0.1:5232\n' >"$publish_dir/GameHost/rust-api.env"
    install_file 0644 \
        "$source_checkout/$caddy_source_path" \
        "$publish_dir/Deploy/solomon-dark-revived.caddy"
    for name in "${game_unit_names[@]}"; do
        install_file 0644 "$source_checkout/ops/nfo/$name" "$publish_dir/Deploy/$name"
    done
    for name in deploy-main.sh run-worker.py install.py deployment-publication.py deploy-runtime.sh parallel-game-saves.py check-linux-artifact.py; do
        install_file 0700 "$source_checkout/ops/local-ci/$name" "$publish_dir/Deploy/M5Worker/$name"
    done
    python3 "$source_checkout/ops/local-ci/check-linux-artifact.py" "$publish_dir"

    for required_file in \
        Deploy/M5Worker/deploy-main.sh \
        Deploy/M5Worker/run-worker.py \
        Deploy/M5Worker/install.py \
        Deploy/M5Worker/deployment-publication.py \
        Deploy/solomon-dark-game.service \
        Deploy/solomon-dark-revived.caddy \
        Server.dll \
        GameHost/solomon-darker \
        GameHost/release.env \
        GameHost/Pixi/game-session-supervisor.mjs \
        GameHost/Pixi/release.env \
        GameHost/Pixi/lua54.wasm \
        GameHost/Pixi/ml-bot-policy-v7-selected.sdml \
        GameHost/rust-api.env \
        RustSite/index.html \
        RustSite/deployment.json \
        game-source-artifact.json \
        game-artifact.json \
        wwwroot/game-rust/assets/native/ml-bot-policy-v7-selected.sdml \
        wwwroot/deployment.json \
        wwwroot/index.html \
        DEPLOYED_GIT_SHA; do
        [[ -f "$publish_dir/$required_file" ]] ||
            fail "published release is missing $required_file"
    done

    artifact_temp="$artifact_root/.$target_sha-$target_game_checksum.$$.tmp"
    tar -czf "$artifact_temp" -C "$publish_dir" .
    artifact_checksum="$(sha_file "$artifact_temp")"
    mv -- "$artifact_temp" "$artifact"
    artifact_temp=""
    checksum_temp="$artifact_root/.$target_sha-$target_game_checksum.$$.sha256.tmp"
    printf '%s\n' "$artifact_checksum" >"$checksum_temp"
    mv -- "$checksum_temp" "$checksum_file"
    checksum_temp=""
    log "Built $artifact_checksum  $artifact"
fi

newest_sha="$(fetch_main)"
if [[ "$newest_sha" != "$target_sha" ]]; then
    log "Artifact $target_sha was superseded by $newest_sha; deferring to the next run"
    discard_artifact
    exit 0
fi

if install_validated_worker; then
    discard_artifact
    log "Installed the validated deployment worker from $target_sha; deferring production cutover to the next run"
    exit 0
else
    worker_update_status=$?
    [[ "$worker_update_status" == 3 ]] || fail "validated worker admission failed"
fi

deployed_sha="$(remote_deployed_sha)"
live_caddy_checksum="$(remote_caddy_checksum)"
live_game_unit_checksum="$(remote_game_unit_checksum)"
live_game_checksum="$(remote_game_artifact_checksum)"
if [[ "$deployed_sha" == "$target_sha" &&
    "$live_caddy_checksum" == "$target_caddy_checksum" &&
    "$live_game_unit_checksum" == "$target_game_unit_checksum" &&
    "$live_game_checksum" == "$target_game_checksum" ]] && remote_publication_ready; then
    discard_artifact
    log "Production reached $target_sha while this run was building"
    exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
# This identity belongs to a cutover, never to a cached immutable game artifact.
deployment_id="$(python3 -c 'import uuid; print(uuid.uuid4().hex)')"
remote_upload="/root/solomon-dark-main-$short_sha-$timestamp.tar.gz"
log "Uploading validated release $target_sha"
"$scp_command" "${ssh_options[@]}" -q "$artifact" "$remote_host:$remote_upload"

if "$ssh_command" "${ssh_options[@]}" "$remote_host" \
    "bash -s -- '$target_sha' '$artifact_checksum' '$remote_upload' '$target_game_unit_checksum' '$target_game_revision' '$target_game_checksum' '$deployment_id'" <"$source_checkout/ops/local-ci/deploy-runtime.sh"
then
    deploy_exit=0
else
    deploy_exit=$?
fi

if (( deploy_exit != 0 )); then
    if (( deploy_exit != 255 )); then
        record_failed_target
    fi
    fail "remote deployment exited with status $deploy_exit"
fi
remote_upload=""

live_sha="$(remote_deployed_sha)"
[[ "$live_sha" == "$target_sha" ]] || fail "production reports $live_sha after deploying $target_sha"
live_caddy_checksum="$(remote_caddy_checksum)"
[[ "$live_caddy_checksum" == "$target_caddy_checksum" ]] ||
    fail "production Caddy site does not match origin/main after deploying $target_sha"
live_game_unit_checksum="$(remote_game_unit_checksum)"
live_game_checksum="$(remote_game_artifact_checksum)"
[[ "$live_game_checksum" == "$target_game_checksum" ]] || fail "production Rust artifact does not match the validated input"
[[ "$live_game_unit_checksum" == "$target_game_unit_checksum" ]] ||
    fail "production game unit does not match origin/main after deploying $target_sha"
curl --ipv4 --fail --silent --show-error --retry 10 --retry-all-errors \
    --retry-delay 1 "$public_url/game" >/dev/null
public_deployment="$(curl --ipv4 --fail --silent --show-error --retry 10 --retry-all-errors \
    --retry-delay 1 "$public_url/game-rust/api/game/deployment")"
python3 - "$public_deployment" "$target_sha" "$target_game_revision" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
# Another completed transaction can reconcile this identical release before the
# remote swap. The drain itself verifies its exact ID; public admission verifies
# the healthy release identity and a well-formed publication from either owner.
import re
if (payload.get("revision") != sys.argv[2] or payload.get("gameRevision") != sys.argv[3]
        or payload.get("ready") is not True
        or not re.fullmatch(r"[0-9a-f]{32}", payload.get("deploymentId", ""))
        or type(payload.get("deploymentSequence")) is not int
        or not 0 < payload["deploymentSequence"] < (1 << 64)):
    raise SystemExit("public deployment publication does not match the healthy replacement")
PY

remote_publication_ready || fail "both runtime publications must be ready"
printf '%s %s\n' "$target_sha" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$state_root/last-success"
[[ ! -f "$failed_target_file" ]] || unlink -- "$failed_target_file"
discard_artifact
log "Production PixiJS $target_sha and Rust $target_game_revision passed live health checks"
