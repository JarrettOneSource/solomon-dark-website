#!/usr/bin/env bash
# Extracts website art from the preserved Solomon Dark 0.72.5 atlases.
# Source: JayMcArthur/Raptisoft-Solomon repo, cloned locally.
# Each crop is generous, then -trim tightens to the sprite's bounding box.
set -euo pipefail

SRC="${1:?Usage: extract-assets.sh <path-to-game-images-dir>}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/frontend/src/assets/game"
mkdir -p "$OUT"

crop() { # crop <atlas> <name> <x> <y> <w> <h>
  magick "$SRC/$1" -crop "$5x$6+$3+$4" +repage -trim +repage "$OUT/$2.png"
}

# ---- Title.png (2048x1024): logo, Solomon, graveyard kit -------------------
crop Title.png logo-solomon-dark  806  128  829 395
crop Title.png eyes-red             0    0  170  60
magick "$SRC/Title.png" -crop 52x26+0+0 +repage "$OUT/eyes-left.png"
magick "$SRC/Title.png" -crop 52x25+114+0 +repage "$OUT/eyes-right.png"
crop Title.png moon               356    0  192 192
crop Title.png hood-a1            170    8  185 335
crop Title.png hood-b1            352    8  185 335
crop Title.png hood-a2            170  340  185 335
crop Title.png hood-b2            352  340  185 335
crop Title.png hood-a3            170  672  185 352
crop Title.png hood-b3            352  672  185 352
crop Title.png grave-cross-1        0   35  120 215
crop Title.png grave-cross-2        0  481  139 199
crop Title.png grave-rip            0  681  152 173
crop Title.png grave-pedestal     550    0  205 128
crop Title.png grave-celtic-swirl 549  116  200 198
crop Title.png grave-arch         549  315  220 252
crop Title.png grave-arch-small   549  568  199 256
crop Title.png obelisk           1636  128  176 367
crop Title.png grave-celtic-cross 1813 128  161 204
crop Title.png grass-strip        806    0 1024  71
crop Title.png clouds-purple      807  558  512 218
crop Title.png clouds-blue       1321  558  512 218

# ---- UI.png (1024x1024): chrome, banners, buttons, ornaments ---------------
crop UI.png circle-arcane   266 205 276 276
crop UI.png levelup         280 138 382  55
crop UI.png banner-fetching 612 552 376  34
crop UI.png banner-drag     608  58 382  40
crop UI.png stone-btn-small 678 126 148  80
crop UI.png stone-slab-big  268 482 348  62
crop UI.png stone-bar-rune  425 560 175  62
crop UI.png stone-bar-plain 422 622 168  60
crop UI.png stone-bar-gem   422 698 178  64
crop UI.png flourish-vert   543 205  67 262
# the sculpted gold skull (the 752,348 crop is a flat watermark ghost)
crop UI.png skull-gold      216 868  41  51
crop UI.png skull-white     160 923  51  59
crop UI.png chain           824  90 120  26
crop UI.png stamp-buy       745 425  78  56
crop UI.png stamp-take      874 587  66  45
crop UI.png stamp-roll       28 452  92  98
crop UI.png stamp-save      296 578  88 145
crop UI.png gargoyle          0 617 138 173
crop UI.png statue-wizard   885 785 130 230
crop UI.png bar-green       425   6 140  26
crop UI.png bar-red         425  28 140  26
crop UI.png arrow-gold      376   3  48  55
crop UI.png gate-iron       267 747 124 267
crop UI.png midnight        272  58 308  80
crop UI.png corner-gold     740 583 118  80
crop UI.png figures-gold      0 928 152  86

# ---- Skills.png (1024x512): element wordmarks, frames, stamp icons ---------
crop Skills.png word-body    258  15 108  52
crop Skills.png word-ether   400  15 125  55
crop Skills.png word-earth   402 105 122  55
crop Skills.png word-fire    408 190  92  60
crop Skills.png word-mind    602 120 102  52
crop Skills.png word-water   812 120 112  55
crop Skills.png word-air     265 380  62  52
crop Skills.png word-arcane  778 290 158  55
crop Skills.png frame-white  582 188  95  95
crop Skills.png frame-glow   678 188  95  95
crop Skills.png frame-gold   764 188  92  95
crop Skills.png icon-boot    186   0  59  59
crop Skills.png icon-heart   186 150  59  59
crop Skills.png icon-fist    246 139  59  59
crop Skills.png icon-wave    242 202  62  58
crop Skills.png icon-infinity 246 306 59  59
crop Skills.png icon-moon    192 392  56  60
crop Skills.png icon-pie     192 452  56  60
crop Skills.png icon-fingers 300 445  50  62
crop Skills.png icon-nuke    120 428  59  59
crop Skills.png icon-bag     386 398  59  59
crop Skills.png icon-horns   580  48  62  55
crop Skills.png icon-book    698  46  59  59
crop Skills.png icon-door    806  46  59  59
crop Skills.png icon-crack   862  45  60  62
crop Skills.png icon-hat     926  46  59  59
crop Skills.png icon-muscle  950 112  55  65
crop Skills.png icon-ban     580 322  62  60
crop Skills.png icon-heartplus 668 325 60 62
crop Skills.png icon-chart   584 441  59  59
crop Skills.png icon-hand    848 355  59  59
crop Skills.png icon-potion   60 189  57  74

# ---- BadGuys.png (2048x2048): ambient haunt sprites -------------------------
crop BadGuys.png fx-fireball    526 602  67 168
crop BadGuys.png fx-wisp-purple 1056 642  43  61
crop BadGuys.png fx-flame       1352 356  29  42
crop BadGuys.png fx-wisp-cyan   1283 404  34  34
crop BadGuys.png fx-spider      1318 404  50  43
crop BadGuys.png fx-imp          964 581  19  19

# ---- College.png (2048x2048): props ----------------------------------------
crop College.png parchment   1401  667 121 118
crop College.png portal-ring 1103 1594 206 206
crop College.png tent-thyngs   33 1722  94 120

# ---- Whole files ------------------------------------------------------------
magick "$SRC/GameOver.png" \
  -region 3x3+0+0 -channel A -evaluate set 0 +channel +region \
  -trim +repage "$OUT/gameover.png"

# ---- hood-dark-1..3: hero cowl animation frames --------------------------------
# The three A-column hood frames from Title.png share cell registration and are
# the title screen's cloth-wave animation. Each gets: a dark ellipse composited
# BEHIND the open cowl (so the sky can't show through) and ramp-faded frame-cut
# edges (top/left/bottom) so no hard sprite boundary shows. The hero mirrors
# them with scaleX(-1), so the faded left edge faces the page.
magick -size 195x30 gradient:black-white /tmp/sdr-vt.png
magick -size 195x272 xc:white /tmp/sdr-vm.png
magick -size 195x30 gradient:white-black /tmp/sdr-vb.png
magick /tmp/sdr-vt.png /tmp/sdr-vm.png /tmp/sdr-vb.png -append /tmp/sdr-vmask.png
magick -size 332x44 gradient:black-white -rotate -90 /tmp/sdr-hl.png
magick -size 151x332 xc:white /tmp/sdr-hr.png
magick /tmp/sdr-hl.png /tmp/sdr-hr.png +append /tmp/sdr-hmask.png
magick /tmp/sdr-vmask.png /tmp/sdr-hmask.png -compose multiply -composite /tmp/sdr-edgemask.png
i=1
for y in 0 332 662; do
  magick "$SRC/Title.png" -crop 195x332+152+$y +repage \
    \( -size 195x332 xc:none -fill '#040209' -draw "ellipse 102,92 58,88 0,360" \) \
    -compose DstOver -composite /tmp/sdr-hood.png
  magick /tmp/sdr-hood.png -alpha extract /tmp/sdr-alpha.png
  magick /tmp/sdr-alpha.png /tmp/sdr-edgemask.png -compose multiply -composite /tmp/sdr-alpha2.png
  magick /tmp/sdr-hood.png /tmp/sdr-alpha2.png -alpha off -compose CopyOpacity -composite "$OUT/hood-dark-$i.png"
  i=$((i+1))
done

# ---- banner-midnight: the story-caption MIDNIGHT wordmark, alpha-ized -------
# The sprite is white text on an opaque black box; luminance becomes alpha so
# the site can overlay it. (The full caption reads "MIDNIGHT / SIX MONTHS AGO";
# we take just the word.)
magick "$SRC/UI.png" -crop 276x42+304+62 +repage -colorspace gray \
  \( +clone \) -alpha off -compose CopyOpacity -composite \
  -channel RGB -evaluate set 100% "$OUT/banner-midnight.png"

# ---- Generated fog tiles (nothing usable in atlases) ------------------------
for i in 1 2; do
  seed=$((i * 41))
  magick -size 1536x768 -seed "$seed" plasma:black-white -blur 0x26 \
    -level 38%,92% -colorspace gray -vignette 0x120 /tmp/sdr-fogmask-$i.png
  magick -size 1536x768 xc:'#c8d0e2' /tmp/sdr-fogmask-$i.png \
    -alpha off -compose CopyOpacity -composite "$OUT/fog-$i.png"
done

echo "Extracted $(ls "$OUT" | wc -l) assets to $OUT"
