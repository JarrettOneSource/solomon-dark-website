#!/usr/bin/bash
set -Eeuo pipefail

umask 077
export GIT_TERMINAL_PROMPT=0

repository_url="${SDR_DEPLOY_REPOSITORY_URL:-https://github.com/JarrettOneSource/solomon-dark-website.git}"
remote_host="${SDR_DEPLOY_REMOTE_HOST:-root@192.223.26.98}"
ssh_command="${SDR_DEPLOY_SSH_COMMAND:-/usr/bin/ssh}"
scp_command="${SDR_DEPLOY_SCP_COMMAND:-/usr/bin/scp}"
ssh_identity="${SDR_DEPLOY_SSH_IDENTITY:-$HOME/.ssh/id_ed25519_nfoservers_root}"
public_url="${SDR_DEPLOY_PUBLIC_URL:-https://solomondarker.com}"
ssh_options=(
    -o BatchMode=yes
    -o ConnectTimeout=15
    -o IdentitiesOnly=yes
    -o StrictHostKeyChecking=yes
    -i "$ssh_identity"
)

data_root="${XDG_DATA_HOME:-$HOME/.local/share}/solomon-dark-main-deploy"
state_root="${XDG_STATE_HOME:-$HOME/.local/state}/solomon-dark-main-deploy"
mirror="$data_root/repository.git"
run_parent="$data_root/runs"
artifact_root="$state_root/artifacts"
lock_file="$state_root/deploy.lock"

run_root=""
source_checkout=""
worktree_registered=0
artifact_temp=""
checksum_temp=""
remote_upload=""

log() {
    printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"
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

    if (( worktree_registered == 1 )); then
        git --git-dir="$mirror" worktree remove --force "$source_checkout" \
            >/dev/null 2>&1 || true
        git --git-dir="$mirror" worktree prune >/dev/null 2>&1 || true
    fi

    if [[ -n "$run_root" && -d "$run_root" ]]; then
        rmdir -- "$run_root" >/dev/null 2>&1 || true
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

remote_session_count() {
    local health
    health="$("$ssh_command" "${ssh_options[@]}" "$remote_host" \
        "curl -fsS http://127.0.0.1:5222/health")"
    python3 - "$health" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
if payload.get("status") != "ok":
    raise SystemExit("game supervisor is not healthy")
sessions = payload.get("sessions")
if not isinstance(sessions, int) or sessions < 0:
    raise SystemExit("game supervisor returned an invalid session count")
print(sessions)
PY
}

for command_name in curl date flock git mktemp python3 sha256sum tar; do
    require_command "$command_name"
done
[[ -x "$ssh_command" ]] || fail "SSH client is not executable: $ssh_command"
[[ -x "$scp_command" ]] || fail "SCP client is not executable: $scp_command"
[[ -r "$ssh_identity" ]] || fail "SSH identity is not readable: $ssh_identity"

mkdir -p -- "$data_root" "$state_root" "$run_parent" "$artifact_root"
if [[ "${SDR_DEPLOY_LOCK_HELD:-}" != 1 ]]; then
    if flock --exclusive --nonblock --close --conflict-exit-code 73 \
        "$lock_file" /usr/bin/env SDR_DEPLOY_LOCK_HELD=1 "$0" "$@"; then
        exit 0
    else
        lock_exit=$?
    fi
    if (( lock_exit == 73 )); then
        log "Another main deployment is already running"
        exit 0
    fi
    exit "$lock_exit"
fi

if [[ ! -d "$mirror/objects" ]]; then
    log "Creating the isolated main mirror"
    git init --quiet --bare "$mirror"
    git --git-dir="$mirror" remote add origin "$repository_url"
else
    git --git-dir="$mirror" remote set-url origin "$repository_url"
fi

target_sha="$(fetch_main)"
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]] || fail "origin/main did not resolve to a commit"
short_sha="${target_sha:0:12}"
artifact="$artifact_root/$target_sha.tar.gz"
checksum_file="$artifact.sha256"

deployed_sha="$(remote_deployed_sha)"
if [[ "$deployed_sha" == "$target_sha" ]]; then
    [[ ! -f "$artifact" ]] || unlink -- "$artifact"
    [[ ! -f "$checksum_file" ]] || unlink -- "$checksum_file"
    log "Production is already at origin/main $target_sha"
    exit 0
fi

artifact_checksum=""
if [[ -f "$artifact" && -f "$checksum_file" ]]; then
    read -r artifact_checksum <"$checksum_file"
    if [[ ! "$artifact_checksum" =~ ^[0-9a-f]{64}$ ]] ||
        ! printf '%s  %s\n' "$artifact_checksum" "$artifact" | sha256sum --check --status; then
        log "Discarding an invalid cached artifact for $target_sha"
        unlink -- "$artifact" "$checksum_file"
        artifact_checksum=""
    fi
fi

if [[ -z "$artifact_checksum" ]]; then
    node_version="$(tr -d '[:space:]' < <(
        git --git-dir="$mirror" show "$target_sha:.node-version"
    ))"
    node_bin="$HOME/.nvm/versions/node/v$node_version/bin"
    [[ -x "$node_bin/node" && -x "$node_bin/npm" ]] ||
        fail "Node.js $node_version is not installed under $HOME/.nvm"
    export PATH="$node_bin:$HOME/.dotnet:/usr/local/bin:/usr/bin:/bin"

    run_root="$(mktemp -d "$run_parent/run.XXXXXXXX")"
    source_checkout="$run_root/source"
    git --git-dir="$mirror" worktree add --quiet --detach "$source_checkout" "$target_sha"
    worktree_registered=1

    log "Validating origin/main $target_sha"
    (
        cd "$source_checkout"
        ./scripts/validate.sh
    )

    newest_sha="$(fetch_main)"
    if [[ "$newest_sha" != "$target_sha" ]]; then
        log "Validated $target_sha was superseded by $newest_sha; deferring to the next run"
        exit 0
    fi

    publish_dir="$source_checkout/.deploy-publish"
    log "Publishing release $target_sha"
    "$HOME/.dotnet/dotnet" publish "$source_checkout/backend/Server.csproj" \
        --configuration Release \
        --no-restore \
        --output "$publish_dir" \
        --nologo \
        --verbosity minimal
    printf '%s\n' "$target_sha" >"$publish_dir/DEPLOYED_GIT_SHA"

    for required_file in \
        Server.dll \
        GameHost/game-session-supervisor.mjs \
        wwwroot/index.html \
        DEPLOYED_GIT_SHA; do
        [[ -f "$publish_dir/$required_file" ]] ||
            fail "published release is missing $required_file"
    done

    artifact_temp="$artifact_root/.$target_sha.$$.tmp"
    tar --create --gzip --file "$artifact_temp" --directory "$publish_dir" .
    checksum_output="$(sha256sum "$artifact_temp")"
    artifact_checksum="${checksum_output%% *}"
    mv -- "$artifact_temp" "$artifact"
    artifact_temp=""
    checksum_temp="$artifact_root/.$target_sha.$$.sha256.tmp"
    printf '%s\n' "$artifact_checksum" >"$checksum_temp"
    mv -- "$checksum_temp" "$checksum_file"
    checksum_temp=""
    log "Built $artifact_checksum  $artifact"
fi

newest_sha="$(fetch_main)"
if [[ "$newest_sha" != "$target_sha" ]]; then
    log "Artifact $target_sha was superseded by $newest_sha; deferring to the next run"
    unlink -- "$artifact" "$checksum_file"
    exit 0
fi

deployed_sha="$(remote_deployed_sha)"
if [[ "$deployed_sha" == "$target_sha" ]]; then
    unlink -- "$artifact" "$checksum_file"
    log "Production reached $target_sha while this run was building"
    exit 0
fi

sessions="$(remote_session_count)"
if (( sessions != 0 )); then
    log "Validated $target_sha; deployment deferred because $sessions game session(s) are active"
    exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
remote_upload="/root/solomon-dark-main-$short_sha-$timestamp.tar.gz"
log "Uploading validated release $target_sha"
"$scp_command" "${ssh_options[@]}" -q "$artifact" "$remote_host:$remote_upload"

if "$ssh_command" "${ssh_options[@]}" "$remote_host" \
    "bash -s -- '$target_sha' '$artifact_checksum' '$remote_upload'" <<'REMOTE_DEPLOY'
set -Eeuo pipefail

target_sha="$1"
expected_checksum="$2"
artifact="$3"
short_sha="${target_sha:0:12}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
live=/opt/solomon-dark-revived
stage="$live.stage-$short_sha-$timestamp"
rollback="$live.rollback-pre-$short_sha-$timestamp"
failed_release="$live.failed-$short_sha-$timestamp"
database=/var/lib/solomon-dark-revived/sdr.db
backup_dir="/var/backups/solomon-dark-revived/pre-$short_sha-$timestamp"
rollback_needed=0
website_stopped=0

session_count() {
    local health
    health="$(curl -fsS http://127.0.0.1:5222/health)"
    python3 - "$health" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
if payload.get("status") != "ok":
    raise SystemExit("game supervisor is not healthy")
sessions = payload.get("sessions")
if not isinstance(sessions, int) or sessions < 0:
    raise SystemExit("game supervisor returned an invalid session count")
print(sessions)
PY
}

cleanup_upload() {
    [[ ! -f "$artifact" ]] || unlink -- "$artifact"
    if (( website_stopped == 1 && rollback_needed == 0 )); then
        systemctl start solomon-dark-revived.service || true
        website_stopped=0
    fi
    if [[ -n "$stage" && -d "$stage" ]]; then
        mv -- "$stage" "$stage.failed" || true
    fi
}

rollback_release() {
    local exit_code=$?
    trap - ERR EXIT
    if (( rollback_needed == 1 )); then
        systemctl stop solomon-dark-revived.service solomon-dark-game.service || true
        if [[ -d "$live" ]]; then
            mv -- "$live" "$failed_release" || true
        fi
        if [[ -d "$rollback" ]]; then
            mv -- "$rollback" "$live"
            systemctl start solomon-dark-game.service solomon-dark-revived.service || true
            website_stopped=0
        fi
    fi
    cleanup_upload
    exit "$exit_code"
}
trap cleanup_upload EXIT
trap rollback_release ERR

checksum_output="$(sha256sum "$artifact")"
actual_checksum="${checksum_output%% *}"
[[ "$actual_checksum" == "$expected_checksum" ]]

current_sha="$(tr -d '\r\n' <"$live/DEPLOYED_GIT_SHA")"
if [[ "$current_sha" == "$target_sha" ]]; then
    exit 0
fi

sessions="$(session_count)"
if (( sessions != 0 )); then
    printf 'Deployment deferred because %s game session(s) became active\n' "$sessions" >&2
    exit 75
fi

mkdir -- "$stage"
tar --extract --gzip --file "$artifact" --directory "$stage"
for required_file in \
    Server.dll \
    GameHost/game-session-supervisor.mjs \
    wwwroot/index.html \
    DEPLOYED_GIT_SHA; do
    [[ -f "$stage/$required_file" ]]
done
[[ "$(tr -d '\r\n' <"$stage/DEPLOYED_GIT_SHA")" == "$target_sha" ]]
chown -R root:root "$stage"
chmod -R u=rwX,go=rX "$stage"

install -d -m 0700 "$backup_dir"
sqlite3 "$database" ".backup '$backup_dir/sdr.db'"
[[ "$(sqlite3 "$backup_dir/sdr.db" 'PRAGMA integrity_check;')" == "ok" ]]

sessions="$(session_count)"
if (( sessions != 0 )); then
    printf 'Deployment deferred because %s game session(s) became active\n' "$sessions" >&2
    exit 75
fi

systemctl stop solomon-dark-revived.service
website_stopped=1
sessions="$(session_count)"
if (( sessions != 0 )); then
    printf 'Deployment deferred because %s game session(s) became active\n' "$sessions" >&2
    exit 75
fi
systemctl stop solomon-dark-game.service
mv -- "$live" "$rollback"
rollback_needed=1
mv -- "$stage" "$live"
stage=""
systemctl start solomon-dark-game.service solomon-dark-revived.service
website_stopped=0

healthy=0
for _attempt in {1..30}; do
    if systemctl is-active --quiet solomon-dark-revived.service &&
        systemctl is-active --quiet solomon-dark-game.service &&
        curl -fsS http://127.0.0.1:5220/ >/dev/null 2>&1 &&
        curl -fsS http://127.0.0.1:5222/health >/dev/null 2>&1; then
        healthy=1
        break
    fi
    sleep 1
done
[[ "$healthy" == 1 ]]
[[ "$(systemctl show -p NRestarts --value solomon-dark-revived.service)" == 0 ]]
[[ "$(systemctl show -p NRestarts --value solomon-dark-game.service)" == 0 ]]
[[ "$(sqlite3 "$database" 'PRAGMA integrity_check;')" == "ok" ]]
[[ "$(tr -d '\r\n' <"$live/DEPLOYED_GIT_SHA")" == "$target_sha" ]]

rollback_needed=0
printf 'Deployed %s\nRollback: %s\nDatabase backup: %s/sdr.db\n' \
    "$target_sha" "$rollback" "$backup_dir"
REMOTE_DEPLOY
then
    deploy_exit=0
else
    deploy_exit=$?
fi

if (( deploy_exit == 75 )); then
    remote_upload=""
    log "Validated $target_sha; deployment deferred because a game session became active"
    exit 0
fi
(( deploy_exit == 0 )) || fail "remote deployment exited with status $deploy_exit"
remote_upload=""

live_sha="$(remote_deployed_sha)"
[[ "$live_sha" == "$target_sha" ]] || fail "production reports $live_sha after deploying $target_sha"
curl --fail --silent --show-error --retry 10 --retry-all-errors \
    --retry-delay 1 "$public_url/game" >/dev/null

printf '%s %s\n' "$target_sha" "$(date --iso-8601=seconds)" >"$state_root/last-success"
[[ ! -f "$artifact" ]] || unlink -- "$artifact"
[[ ! -f "$checksum_file" ]] || unlink -- "$checksum_file"
log "Production deployment of origin/main $target_sha passed live health checks"
