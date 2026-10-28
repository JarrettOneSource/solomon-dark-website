#!/usr/bin/env bash
# NFO owns the atomic release exchange; M5 owns source validation and packaging.
set -Eeuo pipefail

target_sha="$1"
expected_checksum="$2"
artifact="$3"
expected_game_unit_checksum="$4"
target_game_revision="$5"
expected_game_checksum="$6"
deployment_id="$7"
live=/opt/solomon-dark-revived
short_sha="${target_sha:0:12}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
stage="$live.stage-$short_sha-$timestamp"
rollback="$live.rollback-pre-$short_sha-$timestamp"
failed_release="$live.failed-$short_sha-$timestamp"
database=/var/lib/solomon-dark-revived/sdr.db
backup_dir="/var/backups/solomon-dark-revived/pre-$short_sha-$timestamp"
caddy_site=/etc/caddy/sites/solomon-dark-revived.caddy
caddy_candidate="/etc/caddy/sites/.solomon-dark-revived.$short_sha-$timestamp.candidate"
caddy_changed=0
rollback_needed=0
game_env=/etc/solomon-dark-game.env
game_supervisor_url=http://127.0.0.1:5222
unit_names=(solomon-dark-game.service solomon-dark-rust-game.service solomon-dark-rust-api.service)
changed_units=()
stopped_units=()
drained_units=()

validate_caddy() {
    local service_pid binary
    # PATH can retain an older packaged Caddy than the active systemd service.
    service_pid="$(systemctl show --property MainPID --value caddy.service)" || return
    binary="$(readlink -e "/proc/$service_pid/exe")" || return
    "$binary" validate "$@"
}

request_game_restart() {
    local result health
    local SDR_GAME_SUPERVISOR_SECRET
    # shellcheck disable=SC1091
    source "$game_env"
    [[ -n "${SDR_GAME_SUPERVISOR_SECRET:-}" ]]
    health="$(curl --fail --silent --show-error --max-time 10 "$game_supervisor_url/health")"
    python3 - "$health" "$current_game_revision" "$drain_target_revision" <<'PY'
import json, sys
health = json.loads(sys.argv[1])
if health.get('status') != 'ok' or health.get('draining') is not False:
    raise SystemExit('game supervisor is not available for a deployment')
if sys.argv[2] == sys.argv[3] and health.get('deploymentProtocol') != 2:
    raise SystemExit('unchanged-game deployment requires publication-aware game clients')
PY
    # A timed-out response can still leave the authority draining.
    drained_units+=("$drain_unit")
    result="$(curl --fail --silent --show-error --max-time 40 \
        -H "Authorization: Bearer $SDR_GAME_SUPERVISOR_SECRET" \
        -H 'Content-Type: application/json' \
        -H "X-Solomon-Deployment-Id: $deployment_id" \
        -H "X-Solomon-Deployment-Sequence: $deployment_sequence" \
        --data "{\"targetRevision\":\"$drain_target_revision\"}" \
        "$game_supervisor_url/admin/deployments/restart")"
    python3 - "$result" "$drain_target_revision" "$deployment_id" "$health" "$deployment_sequence" <<'PY'
import json, sys
payload = json.loads(sys.argv[1])
if payload.get('status') != 'ready' or payload.get('targetRevision') != sys.argv[2]:
    raise SystemExit('game supervisor did not confirm the deployment target')
if json.loads(sys.argv[4]).get('deploymentProtocol') == 2 and (
        payload.get('deploymentId') != sys.argv[3]
        or payload.get('deploymentSequence') != int(sys.argv[5])):
    raise SystemExit('game supervisor did not confirm the deployment publication')
players, saved, unacknowledged = (payload.get(key) for key in ('players', 'savedPlayers', 'unacknowledgedPlayers'))
if not all(type(value) is int and value >= 0 for value in (players, saved, unacknowledged)):
    raise SystemExit('game supervisor returned invalid deployment counts')
if saved + unacknowledged != players:
    raise SystemExit('game supervisor deployment counts do not balance')
print(f'Game updating drain: players={players} saved={saved} unacknowledged={unacknowledged}')
PY
}

write_deployment_publication() {
    python3 "$publication_tool" write "$1" "$2" "$target_sha" "$3" \
        "$deployment_id" "$deployment_sequence"
}

preflight_units() {
    [[ "$(cat "$stage"/Deploy/solomon-dark-{game,rust-game,rust-api}.service | sha256sum | awk '{print $1}')" == "$expected_game_unit_checksum" ]]
    # Verify paths in the candidate, without editing its signed/source unit files.
    python3 - "$stage" "$live" <<'PY_VERIFY_GAME_UNIT'
from pathlib import Path
import subprocess, sys, tempfile
stage, live = map(Path, sys.argv[1:])
with tempfile.TemporaryDirectory(prefix='solomon-dark-unit-') as directory:
    units = []
    for name in ('solomon-dark-game.service', 'solomon-dark-rust-game.service', 'solomon-dark-rust-api.service'):
        candidate = Path(directory) / name
        candidate.write_text((stage / 'Deploy' / name).read_text().replace(str(live), str(stage)))
        units.append(str(candidate))
    subprocess.run(['systemd-analyze', 'verify', *units], check=True)
PY_VERIFY_GAME_UNIT
}

wait_game() {
    local unit="$1" url="$2" protocol="$3" health
    for _attempt in {1..30}; do
        if systemctl is-active --quiet "$unit" && health="$(curl -fsS --max-time 2 "$url/health")" &&
            python3 - "$health" "$protocol" <<'PY'
import json, sys
value = json.loads(sys.argv[1])
valid = value.get('status') == 'ok' and value.get('draining') is False
valid = valid and (value.get('deploymentProtocol') == 2 if sys.argv[2] == 'rust' else value.get('deploymentProtocol') is None)
raise SystemExit(0 if valid else 1)
PY
        then return; fi
        [[ "$(systemctl show -p Result --value "$unit")" == success ]] || return 1
        sleep 1
    done
    return 1
}

wait_api() {
    local unit="$1" url="$2" revision="$3"
    for _attempt in {1..30}; do
        if systemctl is-active --quiet "$unit" &&
            curl -fsS --max-time 2 "$url/api/game/deployment" | python3 -c \
                'import json,sys; p=json.load(sys.stdin); raise SystemExit(0 if p.get("revision")==sys.argv[1] and p.get("gameRevision")==sys.argv[2] else 1)' "$target_sha" "$revision"; then
            return
        fi
        [[ "$(systemctl show -p Result --value "$unit")" == success ]] || return 1
        sleep 1
    done
    return 1
}

install_units() {
    local name
    for name in "${unit_names[@]}"; do
        if cmp --silent "$live/Deploy/$name" "/etc/systemd/system/$name"; then continue; fi
        if [[ -f "/etc/systemd/system/$name" ]]; then
            install -m 0644 "/etc/systemd/system/$name" "$backup_dir/$name"
        fi
        changed_units+=("$name")
        install -o root -g root -m 0644 "$live/Deploy/$name" "/etc/systemd/system/$name.next"
        mv "/etc/systemd/system/$name.next" "/etc/systemd/system/$name"
    done
    systemctl daemon-reload
}

install_caddy_config() {
    if cmp --silent "$caddy_candidate" "$caddy_site"; then return; fi
    install -o root -g root -m 0644 "$caddy_site" "$backup_dir/solomon-dark-revived.caddy"
    install -o root -g root -m 0644 "$caddy_candidate" "$caddy_site.next"
    caddy_changed=1
    mv "$caddy_site.next" "$caddy_site"
    validate_caddy --config /etc/caddy/Caddyfile >/dev/null
    systemctl reload caddy.service
    systemctl is-active --quiet caddy.service
}

on_exit() {
    local code=$? name
    trap - EXIT
    set +e
    if (( code != 0 )); then
        printf 'Candidate %s failed; restoring the prior runtime and service configuration.\n' "$target_sha" >&2
        journalctl -u solomon-dark-game.service -u solomon-dark-rust-game.service \
            -u solomon-dark-revived.service -u solomon-dark-rust-api.service -n 100 --no-pager >&2
        if (( rollback_needed == 1 )); then
            systemctl stop solomon-dark-rust-api.service solomon-dark-rust-game.service
            if (( root_changed == 1 )); then systemctl stop solomon-dark-revived.service solomon-dark-game.service; fi
            [[ ! -d "$live" ]] || mv "$live" "$failed_release"
            mv "$rollback" "$live" || printf 'ERROR: runtime restoration failed: %s\n' "$rollback" >&2
        fi
        for name in "${changed_units[@]}"; do
            if [[ -f "$backup_dir/$name" ]]; then
                install -o root -g root -m 0644 "$backup_dir/$name" "/etc/systemd/system/$name"
            else
                systemctl disable "$name"
                rm -f "/etc/systemd/system/$name"
            fi
        done
        systemctl daemon-reload
        if (( caddy_changed == 1 )); then
            install -o root -g root -m 0644 "$backup_dir/solomon-dark-revived.caddy" "$caddy_site"
            validate_caddy --config /etc/caddy/Caddyfile && systemctl reload caddy.service
        fi
        # Restart the previous admission owners even when the drain request failed.
        for name in "${drained_units[@]}"; do systemctl restart "$name"; done
        for name in "${stopped_units[@]}"; do systemctl start "$name"; done
        [[ ! -d "$stage" ]] || mv "$stage" "$stage.failed"
    fi
    rm -f "$artifact" "$caddy_candidate" "$caddy_site.next"
    for name in "${unit_names[@]}"; do rm -f "/etc/systemd/system/$name.next"; done
    exit "$code"
}
trap on_exit EXIT

[[ "$(sha256sum "$artifact" | awk '{print $1}')" == "$expected_checksum" ]]
mkdir "$stage"
tar --extract --gzip --file "$artifact" --directory "$stage"
[[ "$(tr -d '\r\n' <"$stage/DEPLOYED_GIT_SHA")" == "$target_sha" ]]
[[ "$(sha256sum "$stage/game-source-artifact.json" | awk '{print $1}')" == "$expected_game_checksum" ]]
python3 "$stage/Deploy/M5Worker/check-linux-artifact.py" "$stage"
preflight_units
install -o root -g root -m 0644 "$stage/Deploy/solomon-dark-revived.caddy" "$caddy_candidate"
validate_caddy --config "$caddy_candidate" --adapter caddyfile >/dev/null

current_sha="$(tr -d '\r\n' <"$live/DEPLOYED_GIT_SHA")"
current_parallel=0
[[ ! -f "$live/GameHost/Pixi/release.env" ]] || current_parallel=1
if [[ "$current_sha" == "$target_sha" && "$current_parallel" == 1 &&
    "$(sha256sum "$live/game-source-artifact.json" | awk '{print $1}')" == "$expected_game_checksum" &&
    "$(cat /etc/systemd/system/solomon-dark-{game,rust-game,rust-api}.service | sha256sum | awk '{print $1}')" == "$expected_game_unit_checksum" ]] &&
    python3 "$stage/Deploy/M5Worker/deployment-publication.py" parallel-ready "$live" "$target_sha" "$target_game_revision"; then
    install -d -m 0700 "$backup_dir"
    install_caddy_config
    rm -rf -- "$stage"
    printf 'Reconciled Caddy for parallel release %s without interrupting games.\n' "$target_sha"
    exit 0
fi
root_changed=1
if [[ "$current_sha" == "$target_sha" && "$current_parallel" == 1 ]]; then root_changed=0; fi
publication_tool="$stage/Deploy/M5Worker/deployment-publication.py"
deployment_sequence="$(python3 "$publication_tool" next "$live/wwwroot/deployment.json")"
write_deployment_publication "$stage/wwwroot/deployment.json" pending "$target_sha"
write_deployment_publication "$stage/RustSite/deployment.json" pending "$target_game_revision"
chown -R root:root "$stage"
chmod -R u=rwX,go=rX "$stage"
install -d -m 0700 "$backup_dir"

if (( root_changed == 1 )); then
    current_game_revision="$current_sha"
    if (( current_parallel == 0 )); then
        current_game_revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["revision"])' "$live/game-artifact.json")"
    fi
    drain_target_revision="$target_sha"
    drain_unit=solomon-dark-game.service
    request_game_restart
fi
if (( current_parallel == 1 )); then
    current_game_revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["revision"])' "$live/game-artifact.json")"
    game_supervisor_url=http://127.0.0.1:5232
    drain_target_revision="$target_game_revision"
    drain_unit=solomon-dark-rust-game.service
    request_game_restart
    stopped_units+=(solomon-dark-rust-api.service solomon-dark-rust-game.service)
    systemctl stop solomon-dark-rust-api.service solomon-dark-rust-game.service
fi
if (( root_changed == 1 )); then
    stopped_units+=(solomon-dark-revived.service solomon-dark-game.service)
    systemctl stop solomon-dark-revived.service solomon-dark-game.service
fi
# The backup includes final saves acknowledged by both clients.
sqlite3 "$database" ".backup '$backup_dir/sdr.db'"
[[ "$(sqlite3 "$backup_dir/sdr.db" 'PRAGMA integrity_check;')" == ok ]]
python3 "$stage/Deploy/M5Worker/parallel-game-saves.py" "$database"
# Each authority keeps its own memorial and diagnostic archives. Copy only the
# existing memorial on the first split; reconnect credentials are never shared.
if (( current_parallel == 0 )); then
    install -d -o solomon-dark -g solomon-dark -m 0750 /var/lib/solomon-dark-rust-game
    if [[ ! -e /var/lib/solomon-dark-rust-game/memoratorium.json && -f /var/lib/solomon-dark-game/memoratorium.json ]]; then
        install -o solomon-dark -g solomon-dark -m 0640 /var/lib/solomon-dark-game/memoratorium.json /var/lib/solomon-dark-rust-game/memoratorium.json
    fi
fi
mv "$live" "$rollback"
rollback_needed=1
mv "$stage" "$live"
publication_tool="$live/Deploy/M5Worker/deployment-publication.py"
install_units
if (( root_changed == 1 )); then systemctl start solomon-dark-game.service; fi
systemctl start solomon-dark-rust-game.service
wait_game solomon-dark-game.service http://127.0.0.1:5222 pixi
wait_game solomon-dark-rust-game.service http://127.0.0.1:5232 rust
if (( root_changed == 1 )); then systemctl start solomon-dark-revived.service; fi
wait_api solomon-dark-revived.service http://127.0.0.1:5220 "$target_sha"
# Schema setup has completed in the primary API before the companion starts.
systemctl start solomon-dark-rust-api.service
wait_api solomon-dark-rust-api.service http://127.0.0.1:5231 "$target_game_revision"
install_caddy_config
for name in solomon-dark-revived.service "${unit_names[@]}"; do
    [[ "$(systemctl show -p NRestarts --value "$name")" == 0 ]]
done
[[ "$(sqlite3 "$database" 'PRAGMA integrity_check;')" == ok ]]
systemctl enable solomon-dark-rust-game.service solomon-dark-rust-api.service
write_deployment_publication "$live/wwwroot/deployment.json" ready "$target_sha"
write_deployment_publication "$live/RustSite/deployment.json" ready "$target_game_revision"
python3 "$publication_tool" parallel-ready "$live" "$target_sha" "$target_game_revision"
rollback_needed=0
printf 'Deployed PixiJS %s and Rust %s\nRollback: %s\nDatabase backup: %s/sdr.db\n' \
    "$target_sha" "$target_game_revision" "$rollback" "$backup_dir"
