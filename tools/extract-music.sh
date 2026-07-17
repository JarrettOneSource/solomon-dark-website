#!/usr/bin/env bash
# Renders web-ready music and UI sounds from the preserved Solomon Dark files.
set -euo pipefail

SRC="${1:?Usage: extract-music.sh <path-to-game-dir>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MUSIC_OUT="$ROOT/frontend/src/assets/music"
SOUND_OUT="$ROOT/frontend/src/assets/sounds"
mkdir -p "$MUSIC_OUT" "$SOUND_OUT"

render_music() {
  local song="$1"
  local subsong="$2"
  local output="$MUSIC_OUT/$song.mp3"
  local duration

  ffmpeg -hide_banner -loglevel error -y \
    -f libopenmpt -subsong "$subsong" -i "$SRC/music/music.mo3" \
    -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-18:TP=-1.5:LRA=11" \
    -ar 44100 -ac 2 -c:a libmp3lame -q:a 5 "$output"

  [[ -s "$output" ]] || { printf 'ERROR: empty output: %s\n' "$output" >&2; return 1; }
  duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$output")"
  awk -v duration="$duration" 'BEGIN { exit !(duration > 0) }' || {
    printf 'ERROR: invalid duration for %s\n' "$output" >&2
    return 1
  }
  if [[ "$song" != "selection" ]] && awk -v duration="$duration" 'BEGIN { exit !(duration < 15) }'; then
    printf 'WARNING: MUSIC TRACK UNDER 15 SECONDS: %s (%ss)\n' "$song" "$duration" >&2
  fi
}

render_sound() {
  local source="$1"
  local name="$2"
  shift 2

  ffmpeg -hide_banner -loglevel error -y -i "$SRC/sounds/$source" "$@" \
    -ac 1 -ar 22050 -c:a libmp3lame -q:a 7 "$SOUND_OUT/$name.mp3"
  [[ -s "$SOUND_OUT/$name.mp3" ]] || {
    printf 'ERROR: empty output: %s\n' "$SOUND_OUT/$name.mp3" >&2
    return 1
  }
}

# Empirical libopenmpt start orders are 0,5,58,70,82,95,101,116,118,122,126,134.
# Order 6 continues inside subsong 1, and order 134 is an extra unlisted sequence,
# so jukebox entries from boss_aggressive through academyold are shifted down one index.
render_music prelude 0
render_music solomondarktheme 5
render_music academy 6
render_music selection 7
render_music academyold 10

# The rest of the score, archived in the repo so the site owns every song in
# the module (only tracks imported by the jukebox ship in the web bundle).
# Subsong 1 is combatprelude + the full layered combat suite in one sequence;
# subsong 11 is the piece music.txt never references — the lost track.
render_music combat 1
render_music boss-aggressive 2
render_music boss-squirmy 3
render_music boss-gargantuan 4
render_music death 8
render_music deathguitar 9
render_music lost-track 11

render_sound click.wav click
render_sound backpack_open.wav backpack-open
render_sound backpack_close.wav backpack-close
render_sound parchment.wav parchment
render_sound staffswoosh.wav staffswoosh
render_sound throwfire.wav cast-fire
render_sound summon.wav summon
render_sound teleport.wav attune
render_sound bonecrack.wav bonecrack
render_sound skeleton_die.wav skeleton-die
render_sound magicbookget__stream.wav tome-get
render_sound YouGetNothing__Stream.wav you-get-nothing
render_sound levelup.wav levelup
render_sound skellyscream.wav skelly-scream
render_sound poof.wav poof
render_sound deepthunder__loop.wav thunder -t 4.5 -af "afade=t=out:st=3.6:d=0.9"

render_voice() {
  local source="$1"
  local name="$2"

  ffmpeg -hide_banner -loglevel error -y -i "$SRC/voices/$source" \
    -ac 1 -ar 22050 -c:a libmp3lame -q:a 7 "$SOUND_OUT/$name.mp3"
  [[ -s "$SOUND_OUT/$name.mp3" ]] || {
    printf 'ERROR: empty output: %s\n' "$SOUND_OUT/$name.mp3" >&2
    return 1
  }
}

# Solomon's laughs — the scurry cameo picks one at random.
render_voice SAY_SOLOMON_LAUGH1.wav laugh-1
render_voice SAY_SOLOMON_LAUGHSMALL1.wav laugh-small-1
render_voice SAY_SOLOMON_LAUGHSMALL2.wav laugh-small-2
render_voice SAY_SOLOMON_LAUGHSMALL3.wav laugh-small-3
render_voice SAY_SOLOMON_LAUGHSMALL4.wav laugh-small-4
render_voice SAY_SOLOMON_LAUGHSMALL5.wav laugh-small-5

printf 'Rendered 12 music tracks, 15 UI sounds, and 6 voice lines.\n'
