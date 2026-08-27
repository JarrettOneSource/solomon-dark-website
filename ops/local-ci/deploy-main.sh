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
caddy_source_path="ops/nfo/solomon-dark-revived.caddy"
game_unit_source_path="ops/nfo/solomon-dark-game.service"
worker_artifact_path="Deploy/solomon-dark-main-deploy"
remote_caddy_site="/etc/caddy/sites/solomon-dark-revived.caddy"
remote_game_unit="/etc/systemd/system/solomon-dark-game.service"
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
failed_target_file="$state_root/failed-target"
worker_path="$HOME/.local/libexec/solomon-dark-main-deploy"
worker_next="${worker_path}.next"

run_root=""
source_checkout=""
worktree_registered=0
artifact_temp=""
checksum_temp=""
failed_target_temp=""
remote_upload=""
worker_temp=""

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
    if [[ -n "$failed_target_temp" && -f "$failed_target_temp" ]]; then
        unlink -- "$failed_target_temp"
    fi
    if [[ -n "$worker_temp" && -f "$worker_temp" ]]; then
        unlink -- "$worker_temp"
    fi
    [[ ! -f "$worker_next" ]] || unlink -- "$worker_next"

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

remote_caddy_checksum() {
    "$ssh_command" "${ssh_options[@]}" "$remote_host" \
        "if test -r '$remote_caddy_site'; then sha256sum '$remote_caddy_site' | awk '{print \$1}'; else printf 'missing\n'; fi"
}

remote_game_unit_checksum() {
    "$ssh_command" "${ssh_options[@]}" "$remote_host" \
        "if test -r '$remote_game_unit'; then sha256sum '$remote_game_unit' | awk '{print \$1}'; else printf 'missing\n'; fi"
}

record_failed_target() {
    failed_target_temp="$state_root/.failed-target.$$"
    printf '%s %s\n' "$target_sha" "$(date --iso-8601=seconds)" >"$failed_target_temp"
    mv -- "$failed_target_temp" "$failed_target_file"
    failed_target_temp=""
}

install_validated_worker() {
    worker_temp="$(mktemp "$state_root/worker.XXXXXXXX")"
    tar --extract --gzip --file "$artifact" --to-stdout \
        "./$worker_artifact_path" >"$worker_temp"
    chmod 0700 "$worker_temp"
    if [[ -f "$worker_path" ]] && cmp --silent "$worker_temp" "$worker_path"; then
        unlink -- "$worker_temp"
        worker_temp=""
        return 1
    fi
    install -D -m 0700 -- "$worker_temp" "$worker_next"
    mv -- "$worker_next" "$worker_path"
    unlink -- "$worker_temp"
    worker_temp=""
    return 0
}

for command_name in cmp curl date flock git install mktemp python3 sha256sum tar; do
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
target_caddy_checksum="$(
    git --git-dir="$mirror" show "$target_sha:$caddy_source_path" |
        sha256sum |
        awk '{print $1}'
)"
[[ "$target_caddy_checksum" =~ ^[0-9a-f]{64}$ ]] ||
    fail "origin/main did not contain a valid Caddy site configuration"
target_game_unit_checksum="$(
    git --git-dir="$mirror" show "$target_sha:$game_unit_source_path" |
        sha256sum |
        awk '{print $1}'
)"
[[ "$target_game_unit_checksum" =~ ^[0-9a-f]{64}$ ]] ||
    fail "origin/main did not contain a valid game systemd unit"
short_sha="${target_sha:0:12}"
artifact="$artifact_root/$target_sha.tar.gz"
checksum_file="$artifact.sha256"

deployed_sha="$(remote_deployed_sha)"
live_caddy_checksum="$(remote_caddy_checksum)"
live_game_unit_checksum="$(remote_game_unit_checksum)"
if [[ "$deployed_sha" == "$target_sha" &&
    "$live_caddy_checksum" == "$target_caddy_checksum" &&
    "$live_game_unit_checksum" == "$target_game_unit_checksum" ]]; then
    [[ ! -f "$artifact" ]] || unlink -- "$artifact"
    [[ ! -f "$checksum_file" ]] || unlink -- "$checksum_file"
    [[ ! -f "$failed_target_file" ]] || unlink -- "$failed_target_file"
    log "Production is already at origin/main $target_sha"
    exit 0
fi
if [[ "$deployed_sha" == "$target_sha" ]]; then
    log "Production runtime is current but its service configuration drifted"
fi
if [[ -f "$failed_target_file" ]]; then
    read -r failed_target_sha _ <"$failed_target_file"
    [[ "$failed_target_sha" =~ ^[0-9a-f]{40}$ ]] ||
        fail "failed deployment target state is invalid"
    if [[ "$failed_target_sha" == "$target_sha" ]]; then
        log "Automatic deployment is suppressed for failed target $target_sha; run ops/local-ci/install.sh from a corrected checkout to retry"
        exit 0
    fi
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
        SDR_BUILD_REVISION="$target_sha" ./scripts/validate.sh
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
    install -D -m 0644 \
        "$source_checkout/$caddy_source_path" \
        "$publish_dir/Deploy/solomon-dark-revived.caddy"
    install -D -m 0644 \
        "$source_checkout/$game_unit_source_path" \
        "$publish_dir/Deploy/solomon-dark-game.service"
    install -D -m 0700 \
        "$source_checkout/ops/local-ci/deploy-main.sh" \
        "$publish_dir/$worker_artifact_path"

    for required_file in \
        Deploy/solomon-dark-main-deploy \
        Deploy/solomon-dark-game.service \
        Deploy/solomon-dark-revived.caddy \
        Server.dll \
        GameHost/game-session-supervisor.mjs \
        GameHost/lua54.wasm \
        GameHost/ml-bot-policy-v7-selected.sdml \
        GameHost/ml-bot-policy-worker.mjs \
        wwwroot/deployment.json \
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

if install_validated_worker; then
    unlink -- "$artifact" "$checksum_file"
    log "Installed the validated deployment worker from $target_sha; deferring production cutover to the next run"
    exit 0
fi

deployed_sha="$(remote_deployed_sha)"
live_caddy_checksum="$(remote_caddy_checksum)"
live_game_unit_checksum="$(remote_game_unit_checksum)"
if [[ "$deployed_sha" == "$target_sha" &&
    "$live_caddy_checksum" == "$target_caddy_checksum" &&
    "$live_game_unit_checksum" == "$target_game_unit_checksum" ]]; then
    unlink -- "$artifact" "$checksum_file"
    log "Production reached $target_sha while this run was building"
    exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
remote_upload="/root/solomon-dark-main-$short_sha-$timestamp.tar.gz"
log "Uploading validated release $target_sha"
"$scp_command" "${ssh_options[@]}" -q "$artifact" "$remote_host:$remote_upload"

if "$ssh_command" "${ssh_options[@]}" "$remote_host" \
    "bash -s -- '$target_sha' '$artifact_checksum' '$remote_upload' '$target_game_unit_checksum'" <<'REMOTE_DEPLOY'
set -Eeuo pipefail

target_sha="$1"
expected_checksum="$2"
artifact="$3"
expected_game_unit_checksum="$4"
short_sha="${target_sha:0:12}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
live=/opt/solomon-dark-revived
stage="$live.stage-$short_sha-$timestamp"
rollback="$live.rollback-pre-$short_sha-$timestamp"
failed_release="$live.failed-$short_sha-$timestamp"
database=/var/lib/solomon-dark-revived/sdr.db
backup_dir="/var/backups/solomon-dark-revived/pre-$short_sha-$timestamp"
caddy_site=/etc/caddy/sites/solomon-dark-revived.caddy
caddy_candidate="/etc/caddy/sites/.solomon-dark-revived.$short_sha-$timestamp.candidate"
caddy_next="${caddy_site}.next"
caddy_backup=""
caddy_changed=0
game_unit=/etc/systemd/system/solomon-dark-game.service
game_unit_next="${game_unit}.next"
game_unit_backup=""
game_unit_changed=0
game_env=/etc/solomon-dark-game.env
game_env_next="${game_env}.next"
game_env_backup=""
game_env_changed=0
game_checkpoint=/opt/solomon-dark-revived/GameHost/ml-bot-policy-v7-selected.sdml
rollback_needed=0
website_stopped=0
game_drained=0

request_game_restart() {
    local result
    local SDR_GAME_SUPERVISOR_SECRET
    # shellcheck disable=SC1091
    source "$game_env"
    [[ -n "${SDR_GAME_SUPERVISOR_SECRET:-}" ]]
    game_drained=1
    result="$(curl --fail --silent --show-error --max-time 40 \
        -H "Authorization: Bearer $SDR_GAME_SUPERVISOR_SECRET" \
        -H 'Content-Type: application/json' \
        --data "{\"targetRevision\":\"$target_sha\"}" \
        http://127.0.0.1:5222/admin/deployments/restart)"
    python3 - "$result" "$target_sha" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
target = sys.argv[2]
if payload.get("status") != "ready" or payload.get("targetRevision") != target:
    raise SystemExit("game supervisor did not confirm the deployment target")
players = payload.get("players")
saved = payload.get("savedPlayers")
unacknowledged = payload.get("unacknowledgedPlayers")
if not all(isinstance(value, int) and value >= 0 for value in (players, saved, unacknowledged)):
    raise SystemExit("game supervisor returned invalid deployment counts")
if saved + unacknowledged != players:
    raise SystemExit("game supervisor deployment counts do not balance")
print(f"Game updating drain: players={players} saved={saved} unacknowledged={unacknowledged}")
PY
}

install_game_checkpoint_path() {
    local checkpoint_lines=()
    mapfile -t checkpoint_lines < <(grep '^SDR_GAME_ML_BOT_CHECKPOINT=' "$game_env")
    [[ "${#checkpoint_lines[@]}" == 1 ]]
    if [[ "${checkpoint_lines[0]}" == "SDR_GAME_ML_BOT_CHECKPOINT=$game_checkpoint" ]]; then
        return
    fi

    install -d -m 0700 "$backup_dir"
    game_env_backup="$backup_dir/solomon-dark-game.env"
    install -o root -g root -m 0600 -- "$game_env" "$game_env_backup"
    python3 - "$game_env" "$game_env_next" "$game_checkpoint" <<'PY'
from pathlib import Path
import sys

source, destination, checkpoint = map(Path, sys.argv[1:])
lines = source.read_text().splitlines(keepends=True)
checkpoint_matches = [
    index
    for index, line in enumerate(lines)
    if line.rstrip("\r\n").startswith("SDR_GAME_ML_BOT_CHECKPOINT=")
]
if len(checkpoint_matches) != 1:
    raise SystemExit("game environment must contain one ML bot checkpoint path")
line = lines[checkpoint_matches[0]]
newline = "\r\n" if line.endswith("\r\n") else "\n" if line.endswith("\n") else ""
lines[checkpoint_matches[0]] = f"SDR_GAME_ML_BOT_CHECKPOINT={checkpoint}{newline}"
destination.write_text("".join(lines))
PY
    chown root:root "$game_env_next"
    chmod 0600 "$game_env_next"
    game_env_changed=1
    mv -- "$game_env_next" "$game_env"
}

restore_game_checkpoint_path() {
    if (( game_env_changed == 0 )); then
        return
    fi
    [[ -n "$game_env_backup" && -f "$game_env_backup" ]]
    install -o root -g root -m 0600 -- "$game_env_backup" "$game_env_next"
    mv -- "$game_env_next" "$game_env"
    game_env_changed=0
}

restore_game_unit() {
    if (( game_unit_changed == 0 )); then
        return
    fi
    [[ -n "$game_unit_backup" && -f "$game_unit_backup" ]]
    install -o root -g root -m 0644 -- "$game_unit_backup" "$game_unit_next"
    mv -- "$game_unit_next" "$game_unit"
    systemctl daemon-reload
    game_unit_changed=0
}

install_game_unit() {
    local candidate="$live/Deploy/solomon-dark-game.service"
    if cmp --silent "$candidate" "$game_unit"; then
        return
    fi

    install -d -m 0700 "$backup_dir"
    game_unit_backup="$backup_dir/solomon-dark-game.service"
    install -o root -g root -m 0644 -- "$game_unit" "$game_unit_backup"
    install -o root -g root -m 0644 -- "$candidate" "$game_unit_next"
    game_unit_changed=1
    mv -- "$game_unit_next" "$game_unit"
    systemctl daemon-reload
}

restore_caddy_config() {
    if (( caddy_changed == 0 )); then
        return
    fi
    [[ -n "$caddy_backup" && -f "$caddy_backup" ]]
    install -o root -g root -m 0644 -- "$caddy_backup" "$caddy_next"
    mv -- "$caddy_next" "$caddy_site"
    caddy validate --config /etc/caddy/Caddyfile >/dev/null
    systemctl reload caddy.service
    caddy_changed=0
}

install_caddy_config() {
    if cmp --silent "$caddy_candidate" "$caddy_site"; then
        return
    fi
    install -d -m 0700 "$backup_dir"
    caddy_backup="$backup_dir/solomon-dark-revived.caddy"
    install -o root -g root -m 0644 -- "$caddy_site" "$caddy_backup"
    install -o root -g root -m 0644 -- "$caddy_candidate" "$caddy_next"
    mv -- "$caddy_next" "$caddy_site"
    caddy_changed=1
    caddy validate --config /etc/caddy/Caddyfile >/dev/null
    systemctl reload caddy.service
    systemctl is-active --quiet caddy.service
}

report_candidate_failure() {
    printf 'Candidate %s failed; service state before rollback:\n' "$target_sha" >&2
    systemctl status solomon-dark-game.service solomon-dark-revived.service \
        --no-pager --full >&2 || true
    printf 'Candidate game journal before rollback:\n' >&2
    journalctl -u solomon-dark-game.service -n 80 --no-pager -o short-iso >&2 || true
    printf 'Candidate Website journal before rollback:\n' >&2
    journalctl -u solomon-dark-revived.service -n 80 --no-pager -o short-iso >&2 || true
}

cleanup_upload() {
    [[ ! -f "$artifact" ]] || unlink -- "$artifact"
    [[ ! -f "$caddy_candidate" ]] || unlink -- "$caddy_candidate"
    [[ ! -f "$caddy_next" ]] || unlink -- "$caddy_next"
    [[ ! -f "$game_unit_next" ]] || unlink -- "$game_unit_next"
    [[ ! -f "$game_env_next" ]] || unlink -- "$game_env_next"
    if (( website_stopped == 1 && rollback_needed == 0 )); then
        systemctl start solomon-dark-revived.service || true
        website_stopped=0
    fi
    if (( game_drained == 1 && rollback_needed == 0 )); then
        systemctl restart solomon-dark-game.service || true
        game_drained=0
    fi
    if [[ -n "$stage" && -d "$stage" ]]; then
        mv -- "$stage" "$stage.failed" || true
    fi
}

rollback_release() {
    local exit_code=$?
    trap - ERR EXIT
    if (( rollback_needed == 1 )); then
        report_candidate_failure
        systemctl stop solomon-dark-revived.service solomon-dark-game.service || true
        if [[ -d "$live" ]]; then
            mv -- "$live" "$failed_release" || true
        fi
        if [[ -d "$rollback" ]]; then
            mv -- "$rollback" "$live"
        fi
    fi
    restore_game_checkpoint_path || true
    restore_game_unit || true
    restore_caddy_config || true
    if (( rollback_needed == 1 )); then
        systemctl start solomon-dark-game.service solomon-dark-revived.service || true
        website_stopped=0
        game_drained=0
    fi
    cleanup_upload
    exit "$exit_code"
}
trap cleanup_upload EXIT
trap rollback_release ERR

checksum_output="$(sha256sum "$artifact")"
actual_checksum="${checksum_output%% *}"
[[ "$actual_checksum" == "$expected_checksum" ]]

tar --extract --gzip --file "$artifact" --to-stdout \
    ./Deploy/solomon-dark-revived.caddy >"$caddy_candidate"
chown root:root "$caddy_candidate"
chmod 0644 "$caddy_candidate"
caddy validate --config "$caddy_candidate" --adapter caddyfile >/dev/null

current_sha="$(tr -d '\r\n' <"$live/DEPLOYED_GIT_SHA")"
current_game_unit_checksum="missing"
if [[ -r "$game_unit" ]]; then
    current_game_unit_checksum="$(sha256sum "$game_unit" | awk '{print $1}')"
fi
if [[ "$current_sha" == "$target_sha" &&
    "$current_game_unit_checksum" == "$expected_game_unit_checksum" ]]; then
    install_caddy_config
    [[ "$(sha256sum "$caddy_site" | awk '{print $1}')" == \
        "$(sha256sum "$caddy_candidate" | awk '{print $1}')" ]]
    caddy_changed=0
    printf 'Reconciled Caddy for %s\nCaddy backup: %s\n' \
        "$target_sha" "${caddy_backup:-unchanged}"
    exit 0
fi

mkdir -- "$stage"
tar --extract --gzip --file "$artifact" --directory "$stage"
for required_file in \
    Deploy/solomon-dark-game.service \
    Deploy/solomon-dark-revived.caddy \
    Server.dll \
    GameHost/game-session-supervisor.mjs \
    GameHost/lua54.wasm \
    GameHost/ml-bot-policy-v7-selected.sdml \
    GameHost/ml-bot-policy-worker.mjs \
    wwwroot/deployment.json \
    wwwroot/index.html \
    DEPLOYED_GIT_SHA; do
    [[ -f "$stage/$required_file" ]]
done
[[ "$(tr -d '\r\n' <"$stage/DEPLOYED_GIT_SHA")" == "$target_sha" ]]
[[ "$(sha256sum "$stage/Deploy/solomon-dark-game.service" | awk '{print $1}')" == \
    "$expected_game_unit_checksum" ]]
systemd-analyze verify "$stage/Deploy/solomon-dark-game.service"
chown -R root:root "$stage"
chmod -R u=rwX,go=rX "$stage"

install -d -m 0700 "$backup_dir"
sqlite3 "$database" ".backup '$backup_dir/sdr.db'"
[[ "$(sqlite3 "$backup_dir/sdr.db" 'PRAGMA integrity_check;')" == "ok" ]]

request_game_restart

systemctl stop solomon-dark-revived.service
website_stopped=1
systemctl stop solomon-dark-game.service
mv -- "$live" "$rollback"
rollback_needed=1
mv -- "$stage" "$live"
stage=""
install_game_checkpoint_path
install_game_unit
install_caddy_config
systemctl start solomon-dark-game.service solomon-dark-revived.service
website_stopped=0
game_drained=0

healthy=0
for _attempt in {1..30}; do
    if systemctl is-active --quiet solomon-dark-revived.service &&
        systemctl is-active --quiet solomon-dark-game.service &&
        curl -fsS http://127.0.0.1:5220/ >/dev/null 2>&1 &&
        curl -fsS http://127.0.0.1:5222/health >/dev/null 2>&1; then
        healthy=1
        break
    fi
    if [[ "$(systemctl show -p Result --value solomon-dark-revived.service)" != success ||
        "$(systemctl show -p Result --value solomon-dark-game.service)" != success ]]; then
        break
    fi
    sleep 1
done
if [[ "$healthy" != 1 ]]; then
    printf 'Candidate %s did not become healthy.\n' "$target_sha" >&2
    false
fi
[[ "$(systemctl show -p NRestarts --value solomon-dark-revived.service)" == 0 ]]
[[ "$(systemctl show -p NRestarts --value solomon-dark-game.service)" == 0 ]]
[[ "$(sqlite3 "$database" 'PRAGMA integrity_check;')" == "ok" ]]
[[ "$(tr -d '\r\n' <"$live/DEPLOYED_GIT_SHA")" == "$target_sha" ]]
grep --fixed-strings --line-regexp --quiet \
    "SDR_GAME_ML_BOT_CHECKPOINT=$game_checkpoint" "$game_env"
[[ "$(sha256sum "$game_unit" | awk '{print $1}')" == \
    "$expected_game_unit_checksum" ]]
[[ "$(sha256sum "$caddy_site" | awk '{print $1}')" == \
    "$(sha256sum "$caddy_candidate" | awk '{print $1}')" ]]

rollback_needed=0
caddy_changed=0
game_env_changed=0
game_unit_changed=0
printf 'Deployed %s\nRollback: %s\nDatabase backup: %s/sdr.db\nCaddy backup: %s\nGame unit backup: %s\nGame env backup: %s\n' \
    "$target_sha" "$rollback" "$backup_dir" "${caddy_backup:-unchanged}" \
    "${game_unit_backup:-unchanged}" "${game_env_backup:-unchanged}"
REMOTE_DEPLOY
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
[[ "$live_game_unit_checksum" == "$target_game_unit_checksum" ]] ||
    fail "production game unit does not match origin/main after deploying $target_sha"
curl --fail --silent --show-error --retry 10 --retry-all-errors \
    --retry-delay 1 "$public_url/game" >/dev/null
public_deployment="$(curl --fail --silent --show-error --retry 10 --retry-all-errors \
    --retry-delay 1 "$public_url/deployment.json")"
python3 - "$public_deployment" "$target_sha" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
if payload != {"revision": sys.argv[2]}:
    raise SystemExit("public deployment manifest does not match origin/main")
PY

printf '%s %s\n' "$target_sha" "$(date --iso-8601=seconds)" >"$state_root/last-success"
[[ ! -f "$failed_target_file" ]] || unlink -- "$failed_target_file"
[[ ! -f "$artifact" ]] || unlink -- "$artifact"
[[ ! -f "$checksum_file" ]] || unlink -- "$checksum_file"
log "Production deployment of origin/main $target_sha passed live health checks"
