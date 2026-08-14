#!/usr/bin/env bash
# Extracts the native-parity /game score and exact WAV cues from a stock install.
set -euo pipefail

SOURCE_DIR="${1:?Usage: extract-game-audio.sh <path-to-game-dir>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MUSIC_SOURCE="$SOURCE_DIR/music/music.mo3"
MUSIC_OUT="$ROOT/frontend/src/assets/game/audio/music"
SFX_OUT="$ROOT/frontend/src/assets/game/audio/sfx"

readonly MODULE_SHA256=32bf92cc3191e136b6d186d77d75de48ad28f4bd58acae0c278204455fa57c82

verify_sha256() {
  local path="$1"
  local expected="$2"
  local actual
  actual="$(sha256sum -- "$path" | awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    printf 'ERROR: unexpected SHA-256 for %s\nexpected: %s\nactual:   %s\n' \
      "$path" "$expected" "$actual" >&2
    return 1
  fi
}

render_music() {
  local name="$1"
  local subsong="$2"
  local minimum_seconds="$3"
  local maximum_seconds="$4"
  local output="$MUSIC_OUT/$name.mp3"
  local duration

  ffmpeg -hide_banner -loglevel error -y \
    -f libopenmpt -subsong "$subsong" -i "$MUSIC_SOURCE" \
    -map_metadata -1 -ar 44100 -ac 2 -c:a libmp3lame -q:a 2 -write_xing 1 \
    "$output"

  [[ -s "$output" ]] || { printf 'ERROR: empty output: %s\n' "$output" >&2; return 1; }
  duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$output")"
  awk -v duration="$duration" -v minimum="$minimum_seconds" -v maximum="$maximum_seconds" \
    'BEGIN { exit !(duration >= minimum && duration <= maximum) }' || {
      printf 'ERROR: unexpected duration for %s: %ss\n' "$output" "$duration" >&2
      return 1
    }
}

copy_sfx() {
  local source="$1"
  local output="$2"
  local expected_sha256="$3"
  local source_path="$SOURCE_DIR/sounds/$source"
  local output_path="$SFX_OUT/$output"

  verify_sha256 "$source_path" "$expected_sha256"
  mkdir -p "$(dirname "$output_path")"
  cp -- "$source_path" "$output_path"
  verify_sha256 "$output_path" "$expected_sha256"
}

verify_sha256 "$MUSIC_SOURCE" "$MODULE_SHA256"
mkdir -p "$MUSIC_OUT" "$SFX_OUT"

# music.txt start orders 95, 101, and 116 resolve to libopenmpt subsongs 5, 6,
# and 7. Unlike the public-site jukebox, /game preserves native starts/levels:
# no silence removal and no loudness normalization.
render_music solomondarktheme 5 67 69
render_music academy 6 155 158
render_music selection 7 19 21

copy_sfx click.wav click.wav 8aeebcfeb69625bee2ee78fe9c63939e6b40edcc89d5facf2c0d35e1b5920307
copy_sfx pickskill.wav pickskill.wav 494d1b973bd3f319199199ec9cf851491caee10c3d72dbe61acda69d28daabe4
copy_sfx catchit__stream.wav catchit.wav d2d26d32d0701fb7c08432f59eca099d75e33842f01ec89eae60b467ad90bf39
copy_sfx ChooseElement__Stream.wav choose-element.wav 04c30a7b387bb5173bebe181a4e3540004c9be09e782b897ac6c67bf14dca406
copy_sfx StartCast__Stream.wav start-cast.wav bccf1c352893ee24d515b09df4fd0d44c733dc3bdab71fe2bf0710bdc14d93a8
copy_sfx magicmissile.wav magic-missile.wav a7765b778d5cc49546c5e7e7822f38aac6a3edd8636d91e4ae92ec78611ac567
copy_sfx throwfire.wav throw-fire.wav b6e14b90d00e27a9b2ceba404ea1c113a7d7bf5f14aa69987ec9629669b53de0
copy_sfx fireballhit.wav fireball-hit.wav 9bfad709cfb932b7e836c58f781a42ee78907a0211bac5d14a2583d721192738
copy_sfx lightningstart.wav lightning-start.wav 1542ec3ab4e41624b5e8d073000a02bb36a3f8c733bf709835768f095494dceb
copy_sfx lightningloop__loop.wav lightning-loop.wav 4bdd74a6734206d1212c52d623d0b7fe994bf4beeaa2119d34f3d1fad7d68281
copy_sfx icestart.wav ice-start.wav 28cfda1e9d59f39dfacfd808cdb267465592ae5ce0d34a9aa4495a3f659b9694
copy_sfx iceloop__loop.wav ice-loop.wav fd9aa082bd5bb3b6197528a5f2d6771aac7e2f478d8bdca0abd3d521c70fc89a
copy_sfx gatherrocksloop__loop.wav gather-rocks-loop.wav 143cfa6a54d77570d3d929c3c536fe0306a9a1f1f5292cf4c1521481d5895990
copy_sfx startboulder.wav start-boulder.wav c7bbd54f293ae2b8a9dbde4d8a6810a5f98f46ee6fb20912b378631a5033d503
copy_sfx rollingstoneloop__loop.wav rolling-stone-loop.wav 66a306a2ebe8443cb017ce8c3737477f196600a82af7472201cc123f70cee706
copy_sfx rockhit.wav rock-hit.wav 865484cf3d7c2e199fb46f069973c43893122e934f0f46ba33d30eeeac4de25b
copy_sfx summon.wav summon.wav 3c910b3918c0f45558123464301ed423974bf2356dfb8934c7d9321addac38cd
copy_sfx Step/step1.wav step/step1.wav ded73389ae0481167c73a904f95c1dc12c89c7e807b5815bb65b8a786582322a
copy_sfx Step/step2.wav step/step2.wav 62c9ef1c7dfd68762dc32aca8d718e385821c102f4ada11502f93bf23ae50dba

printf 'Extracted 3 native game tracks and 19 exact native WAV cues.\n'
