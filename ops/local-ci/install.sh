#!/usr/bin/bash
set -euo pipefail

source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
libexec_dir="$HOME/.local/libexec"
unit_dir="$HOME/.config/systemd/user"

for command_name in git install systemctl; do
    command -v "$command_name" >/dev/null 2>&1 || {
        printf '%s is required\n' "$command_name" >&2
        exit 1
    }
done

if systemctl --user is-active --quiet solomon-dark-main-deploy.service; then
    printf 'The deployment worker is active; wait for it to finish before reinstalling.\n' >&2
    exit 1
fi
systemctl --user stop solomon-dark-main-deploy.timer >/dev/null 2>&1 || true

install -d -m 0755 "$libexec_dir" "$unit_dir"
install -m 0700 "$source_dir/deploy-main.sh" \
    "$libexec_dir/solomon-dark-main-deploy"
install -m 0644 "$source_dir/solomon-dark-main-deploy.service" \
    "$unit_dir/solomon-dark-main-deploy.service"
install -m 0644 "$source_dir/solomon-dark-main-deploy.timer" \
    "$unit_dir/solomon-dark-main-deploy.timer"

systemctl --user daemon-reload
systemctl --user enable --now solomon-dark-main-deploy.timer
systemctl --user start solomon-dark-main-deploy.service

printf 'Installed the Solomon Dark main deployment timer.\n'
printf 'Inspect it with: systemctl --user status solomon-dark-main-deploy.timer\n'
printf 'Follow runs with: journalctl --user -u solomon-dark-main-deploy.service -f\n'
