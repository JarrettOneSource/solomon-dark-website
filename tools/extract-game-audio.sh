#!/usr/bin/env bash
# Extracts the native-parity /game score and exact WAV cues from a stock install.
set -euo pipefail

SOURCE_DIR="${1:?Usage: extract-game-audio.sh <path-to-game-dir>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MUSIC_SOURCE="$SOURCE_DIR/music/music.mo3"
MUSIC_OUT="$ROOT/frontend/src/assets/game/audio/music"
SFX_OUT="$ROOT/frontend/src/assets/game/audio/sfx"
VOICE_OUT="$ROOT/frontend/src/assets/game/audio/voice"

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

copy_dynamic_sfx() {
  local source="$1"
  local output="$2"
  local expected_sha256="$3"
  local source_path="$SOURCE_DIR/dynamic_sounds/$source"
  local output_path="$SFX_OUT/$output"

  verify_sha256 "$source_path" "$expected_sha256"
  mkdir -p "$(dirname "$output_path")"
  cp -- "$source_path" "$output_path"
  verify_sha256 "$output_path" "$expected_sha256"
}

copy_voice() {
  local source="$1"
  local output="$2"
  local expected_sha256="$3"
  local source_path="$SOURCE_DIR/voices/$source"
  local output_path="$VOICE_OUT/$output"

  verify_sha256 "$source_path" "$expected_sha256"
  mkdir -p "$(dirname "$output_path")"
  cp -- "$source_path" "$output_path"
  verify_sha256 "$output_path" "$expected_sha256"
}

verify_sha256 "$MUSIC_SOURCE" "$MODULE_SHA256"
mkdir -p "$MUSIC_OUT" "$SFX_OUT" "$VOICE_OUT"

# music.txt start orders 0, 5, 95, 101, and 116 resolve to libopenmpt subsongs
# 0, 1, 5, 6, and 7. Unlike the public-site jukebox, /game preserves native starts/levels:
# no silence removal and no loudness normalization.
render_music prelude 0 55 56
render_music combat 1 781 783
render_music solomondarktheme 5 67 69
render_music academy 6 155 158
render_music selection 7 19 21

copy_sfx click.wav click.wav 8aeebcfeb69625bee2ee78fe9c63939e6b40edcc89d5facf2c0d35e1b5920307
copy_sfx concentrate.wav concentrate.wav ca8b10ff2ce00ca913a382c05f3e1c0c600a22d2e206e386e52a4e83d704a47c
copy_sfx levelup.wav level-up.wav ca01cafec3167ee5bb37f0cb6605196d38bca45c7b755d5fa11781d3e4a5ea92
copy_sfx pickskill.wav pickskill.wav 494d1b973bd3f319199199ec9cf851491caee10c3d72dbe61acda69d28daabe4
copy_sfx backpack_open.wav backpack-open.wav 8193adb7284d9c14c9045b7b9aaace7b17baa7f75eb8e77e82cb2ee2c572c81b
copy_sfx backpack_close.wav backpack-close.wav 32fa4ca58d0fe1eb967bb50f20dffc0edb98b25ca74c719edc2b70b9e4312319
copy_sfx poof.wav poof.wav 170d816eaedfddd973ee12505fc2a1f823a3f8b4e286f16743b469276016e005
copy_sfx catchit__stream.wav catchit.wav d2d26d32d0701fb7c08432f59eca099d75e33842f01ec89eae60b467ad90bf39
copy_sfx ChooseElement__Stream.wav choose-element.wav 04c30a7b387bb5173bebe181a4e3540004c9be09e782b897ac6c67bf14dca406
copy_sfx StartCast__Stream.wav start-cast.wav bccf1c352893ee24d515b09df4fd0d44c733dc3bdab71fe2bf0710bdc14d93a8
copy_sfx magicmissile.wav magic-missile.wav a7765b778d5cc49546c5e7e7822f38aac6a3edd8636d91e4ae92ec78611ac567
copy_sfx throwfire.wav throw-fire.wav b6e14b90d00e27a9b2ceba404ea1c113a7d7bf5f14aa69987ec9629669b53de0
copy_sfx fireballhit.wav fireball-hit.wav 9bfad709cfb932b7e836c58f781a42ee78907a0211bac5d14a2583d721192738
copy_sfx flamelashstart.wav flame-lash-start.wav d563633ce5ed2701050884b11806898da500581858238d45fb881e820db0a1dc
copy_sfx fizzle.wav fizzle.wav 938420950d859ebc00a9b1a37e548c7c2183a8504689b32aab3de3c683899e76
copy_sfx lightningstart.wav lightning-start.wav 1542ec3ab4e41624b5e8d073000a02bb36a3f8c733bf709835768f095494dceb
copy_sfx lightningloop__loop.wav lightning-loop.wav 4bdd74a6734206d1212c52d623d0b7fe994bf4beeaa2119d34f3d1fad7d68281
copy_sfx icestart.wav ice-start.wav 28cfda1e9d59f39dfacfd808cdb267465592ae5ce0d34a9aa4495a3f659b9694
copy_sfx iceloop__loop.wav ice-loop.wav fd9aa082bd5bb3b6197528a5f2d6771aac7e2f478d8bdca0abd3d521c70fc89a
copy_sfx gatherrocksloop__loop.wav gather-rocks-loop.wav 143cfa6a54d77570d3d929c3c536fe0306a9a1f1f5292cf4c1521481d5895990
copy_sfx startboulder.wav start-boulder.wav c7bbd54f293ae2b8a9dbde4d8a6810a5f98f46ee6fb20912b378631a5033d503
copy_sfx rollingstoneloop__loop.wav rolling-stone-loop.wav 66a306a2ebe8443cb017ce8c3737477f196600a82af7472201cc123f70cee706
copy_sfx rockhit.wav rock-hit.wav 865484cf3d7c2e199fb46f069973c43893122e934f0f46ba33d30eeeac4de25b
copy_sfx summon.wav summon.wav 3c910b3918c0f45558123464301ed423974bf2356dfb8934c7d9321addac38cd
copy_sfx swipe.wav swipe.wav a7ceda1c35fc9896f10ef808c626267eb3b58d958323fef76f47e2bff7716198
copy_sfx shootarrow.wav shoot-arrow.wav a155d0ab8b11b6c88d0248aad41c46c95a734c638b1f15114051f0affebfa1b5
copy_sfx CriticalHit.wav critical-hit.wav ccf8ffc6bea19fd51c18a51d04cc9ef2d6d727213573fd47859a23325677b03b
copy_sfx DisableEnemy.wav disable-enemy.wav e7e0dfed0c7e10745a545ef18ac872094d35b16535bc249b6022e8964ed186f4
copy_sfx Knockback.wav knockback.wav 16fee24874ab67546e35b8a08469760088c3da387e4ae8f7243a0a31263cc4dd
copy_sfx spinattack.wav spin-attack.wav dbe81e2ce3a19074efa975be444072614995216b9f880c14b287ab552bcbff4f
copy_sfx staffswoosh.wav staff-swoosh.wav 04da914c919485d68cd49752a0726649cc5395bb47febcfcabee4765d71f2809
copy_sfx staffhitwood.wav staff-hit-wood.wav 0e682ef1ba77ba08cd3b52c5a98eefe0fcb31797275a07fdce6a03abfa484b50
copy_sfx pikebreak__stream.wav pike-break.wav 7095f48810f60a759aef5f584d5eb52b7a0c82030b27abb1af782a9281441e82
copy_sfx Step/step1.wav step/step1.wav ded73389ae0481167c73a904f95c1dc12c89c7e807b5815bb65b8a786582322a
copy_sfx Step/step2.wav step/step2.wav 62c9ef1c7dfd68762dc32aca8d718e385821c102f4ada11502f93bf23ae50dba
copy_sfx dropcoins.wav drop-coins.wav b72d44080d99fdae8e7dce83b5f1b6a553d503a753df2deacea7ee8829ba4376
copy_sfx droppotion.wav drop-potion.wav c538d651ff612cfb56b9c618cec60eaa4b96da78ecc81b20950977cade359e45
copy_sfx gotorb.wav goto-orb.wav e971ea0fcc9fee14e93936b83768862ff24cc61106e741c66e48f709b9c5893a
copy_sfx pickupcoin.wav pickup-coin.wav 04a1ea7b62cdaf0fd55cf237911594d75d79c0cf5cdf7962078f2949b9f4da34
copy_sfx pickupbag.wav pickup-bag.wav 8b299623b5b51dc6b56dfb1acc3821664d8857a02a70179f6ba3330182443902
copy_sfx dropbag/dropbag1.wav drop-bag-1.wav c2f0b7f9111d727a9e66b7e47e80aa79ba21dc5bc83781e01be0409755651379
copy_sfx dropbag/dropbag2.wav drop-bag-2.wav 1ec0a6ecf46d8d7ca0b92bb4ed62f78ca4582abc5365aa8d17c2916f05c22203
copy_sfx Wizard_Ouch/SAY_OUCH1.wav wizard-ouch-1.wav 3e851ee873c9798923624d2b117c6fc91d656f66d7961a00935cfb182393b638
copy_sfx Wizard_Ouch/SAY_OUCH2.wav wizard-ouch-2.wav 509ce875de5322ebc4ee883cf2f1db9ba172b1cf22a6a6da6e31a0e2c91d12b7
copy_sfx Wizard_Ouch/SAY_OUCH3.wav wizard-ouch-3.wav 26cd8bea5d55a47b6476f130481bad26887f7af1cf12ec43b2989e495323e5ea
copy_dynamic_sfx wipeglass.wav polisher-wipe-loop.wav ad5043df28f0ee18e881ffe709fc819218533b080d6d1ec4093603d8447e4d57

# Complete stock right-click ability lifecycle bank. These remain separate
# cues because native ownership distinguishes one-shots, streams, and loops.
copy_sfx acidsizzle.wav acid-sizzle.wav 14b50ede8d3b280d65877a0c5d51a331e0da5c6b0d70da20c9345584c7453341
copy_sfx bigfire.wav big-fire.wav d70d4a94b490b7ea7f72d26a06edb50e7906a6a5ca095e1e80744fd17bf17868
copy_sfx comet__loop.wav comet-loop.wav b8c4c69e2220778492eb25118a6c4a72169f5db3ee9e14e56210e8aba6d8fc80
copy_sfx cometwhistle.wav comet-whistle.wav d0ca5910d9dbe434937c1d11ddfe1957fd287a13b81b7ee27f63fb969a3d4cb6
copy_sfx dampen__stream.wav dampen.wav afc7ef6fa91604257c17abf6276190343c7a556709426c9c9ba4f7e165c106b1
copy_sfx distortreality.wav distort-reality.wav 3fa59accc564838ea1896f95539ee0acecd9345c3e2c1adceaadee0dd870194e
copy_sfx electric__loop.wav electric-loop.wav 809601e64da07ac0adfffec5f5e29dfc61ee79725fdbf85ceb501d80d6cb0db4
copy_sfx earthquake__loop.wav earthquake-loop.wav ac56c68d267f5d9c7431b8cadd5b6bd4e73ae6101e144ff9769d2aac1a529068
copy_sfx explodesteam.wav explode-steam.wav f93fca2917072811b96f4ec4c3c864c66f0bb785f05c6113e1931661471df090
copy_sfx flash.wav enemy-flash.wav dfbee90531011a439650ee0bbf30a3c5ea9469ccd97a9979c05ba73f3db9c05c
copy_sfx flashspell.wav flash-spell.wav fda25c45eab0290011b1f3ba859757578586b30c3e7f1c905077f801af0ee5be
copy_sfx GolemDie__Stream.wav golem-die.wav cee482491c4aa21672bf7bbd4c314ab185a5e15f9daadfaa5351d0e3ca8fea56
copy_sfx GolemProvoke__Stream.wav golem-provoke.wav 88394eabae8728019803317c69dc8a7e991bb2ce32863f250a2d0726e7f15228
copy_sfx hitshield.wav hit-shield.wav ad5a4870955e5393c17a03c847af274f7a054b62a4c712582206623d1d92ad3f
copy_sfx ignite.wav ignite.wav 0c0a6f6055b0746e8f1921d04214e47a359ee36b6ea88301f73047f7f45e935f
copy_sfx KnockbackGolem.wav knockback-golem.wav 2452f75de45f6e6c30d7bc9993ba6f86e638ef0b2a101daca38814e65946e090
copy_sfx LeviathanRoar__Stream.wav leviathan-roar.wav 67d19694db3f9865e8083365bdb2986dbae4827868f335a7070b5e46e632fcec
copy_sfx lowfire__loop.wav low-fire-loop.wav 8d42e14b1848f1f2b45fabb52c1f83620a986557416f59ee08f78e630439ce8a
copy_sfx magiccircle.wav magic-circle.wav 18e8efdd324e9c3f96aca245d109d50796418ada18685c8e391c5f122921e4c3
copy_sfx magicshieldexplode.wav magic-shield-explode.wav 5a3abd93fc1d490b0f9988f1acebc948c5fed9669f070012c97c778010854b8a
copy_sfx magicshieldup.wav magic-shield-up.wav 74305127ff81aaf41abe9001d8498f7c14b46fed099d7b28c49bad4bc23f06cc
copy_sfx magicstorm.wav magic-storm.wav 87a2987ef6a67c21a8c57e8c5f17d88b78e6071b97cf34c6fd9a12ff613ebdcb
copy_sfx mindstar__stream.wav mindstar.wav 8a4310894e1401f9d47e58ae4f9202aec1e1eb0f6dd34db6987e6e3e753b5de8
copy_sfx nuke.wav nuke.wav a8ab88bb44f30289f7b473bc9f153b4cfc03b1985e77b7b29a7ec0761f8b2cfb
copy_sfx phase.wav phase.wav cbd9572e6910191bab3b856120e39c67573efd708514b3443eac27bc0c6f48d3
copy_sfx PlaneCross__Loop.wav plane-cross-loop.wav 04d3bc7b433ef47b758933456e9feecb83924fa9b0ec31e0aeedb0946cd14a24
copy_sfx planewalker__Stream.wav planewalker-on.wav 1243f30337c134c4d59f1cf8fbd2eb79fa0ce4a8e6e053866ec82ac0ec7689ea
copy_sfx PlanewalkerOff__Stream.wav planewalker-off.wav f95191b9c552b177d96d7269259350695727636d6287af7bbf93ffc08dc8d322
copy_sfx popshield.wav pop-shield.wav b4d6bf4d9a68f11bab92def6e823a53f6b8534c49b96e80bbf25d99972af2503
copy_sfx prismaticspray__stream.wav prismatic-shock.wav 3eabc7fb5d4ecb30476dc0dee52305f66e47ae212ca47bdf8d087961a77cdc7d
copy_sfx QuakeCracks__Stream.wav quake-cracks.wav 86e0ff907b480cde99a14ad4743946214040fca0fb3fe0f26036762f559375c8
copy_sfx QuakeCrackSmall__Stream.wav quake-crack-small.wav bc66694a8413cddaf3ca22b05de99ba3d8d59090317e3d89c983a1d3b09ef09f
copy_sfx rainfall__loop.wav rainfall-loop.wav a27e5ea5d44bb5daf6b80dee6f0f5c9123a5bddfc198340c633b8791c4733a79
copy_sfx ringofice.wav ring-of-ice.wav b6442d06818350c43d135684916f05216ed90dccf2b27f2a5667c2c31482013b
copy_sfx settrap__Stream.wav set-trap.wav 32e4b7ab20002a21895d1e314a8641b01b4c17d3bd76789997acbb0cf43b2ea4
copy_sfx steadywind__loop.wav steady-wind-loop.wav 2c87905f66fa7b02ab18c6b9e5d875ed2c9258ce37c961ba858c17d031141487
copy_sfx stonebreak.wav stone-break.wav 1bb6ea8c298424eddedad619ec713b23f8187986a8ecdc28173a0b17d2070abc
copy_sfx stoneskin.wav stoneskin.wav 7d3337d2d05ddfb63f0129406c6f1867de0262535b055b9aa69d633dbd261635
copy_sfx StoneSkin__Stream.wav stoneskin-on.wav 033f53f0529caac2f5f59f7501a60917e30b1af44035e1ab92a27d0959511d62
copy_sfx stonestep.wav stone-step.wav d02824968e070e0efdeb3c350afd004ff9252dd6da806aebf9c6b3da5d01c5f5
copy_sfx teleport.wav teleport.wav a91651f4369aa2147729d043e0b29b758ec1481877b931bb800fe1828ca329a2
copy_sfx thunder__Stream.wav thunder.wav c2bc1376ed9a5bc8de7b96f08c16448253a7cfbe35b35a085a282d0a50d12f0a
copy_sfx trap__stream.wav trap.wav f575c617afd3da0eb5a65016b9eec178e82da536a9bf410e617dd76dc8c158d8

copy_voice SAY_SOLOMONDARKSHOWYOURSELF.wav tutorial-show-yourself.wav e1f8c9cea2b009a109354c223d2042d73ec450457a1eedf0130f0d093c9f4f6e
copy_voice SAY_IAMSIRMIN.wav tutorial-i-am-sirmin.wav 9be6dfcb15158215a11a2a1e00037dc46137c439665026f142835edce0634193
copy_voice SAY_NEVERHEARDOFYOU.wav tutorial-never-heard-of-you.wav 1c10ee772039eda014d0a081422003531e0486694dc3ab876bd3426935ba7016
copy_voice SAY_EASILYVANQUISHED.wav tutorial-easily-vanquished.wav 4b7eaede2a8903cdec1c25cc8dcd3e300dad70e21267989bc68b8741eca1c5c7
copy_voice SAY_ICAMEPREPARED.wav tutorial-came-prepared.wav f9704e8fae16a628f5aa163a9bafd0268f321dbfe4098b64b6b4be6ad3954693
copy_voice SAY_ACIDRAINHUH.wav tutorial-acid-rain-huh.wav 31100158ed53b65be98e7e9dedd6b5637b209e6aa9052fc32eaba187ee272ba4
copy_voice SAY_SURRENDER.wav tutorial-surrender.wav 7473e560efdda24c256a7d360aa765ab29cca444626aee642f53c9b657e00ee8
copy_voice SAY_CARELESSFOOL.wav tutorial-careless-fool.wav 4baa3d3d999f8395ad68f2b2014ef7e38c278503b7fddc541bd8a1071bfb9682
copy_voice SAY_UNREDEEMABLE.wav tutorial-unredeemable.wav 937325457f6140b67e21276b9c573cabf4bcc254134b0831f56b8d9cb1458e2f
copy_voice SAY_SOUNDLIKEMYMOTHER.wav tutorial-sound-like-mother.wav efce4a898a667bb758c2df16d3e2d073cdeb1b3782435d57bf08a1cac361c012
copy_voice SAY_ACCEPTYOURFATE.wav tutorial-accept-your-fate.wav 609528847afb6161d2e3f178d81f80574eb3a5ebed63b2e8b096539d852b38a9
copy_voice SAY_MAKEMESTRONGER.wav tutorial-make-me-stronger.wav 0d333cf07c0e08d61001d979806c448174d048653cd001147ca0a109d441b04d
copy_voice SAY_LEVELLINGUP.wav tutorial-levelling-up.wav 7124c578c133671366caf6285b15508b06efe8e174228d6853a24078ca456fb1
copy_voice SAY_LOOKINGBEATUP.wav tutorial-looking-beat-up.wav 0956e770c3bba32053ece64a932c98559c56b71075c96818d01a6cb8d25a07d5
copy_voice SAY_FACETHEWRATH.wav tutorial-face-the-wrath.wav c015f7fa573744bd89b4fed535bc54afd8b2bc8ecdc7f2774c2ec2929861d2f1
copy_voice SAY_IMBORED.wav tutorial-im-bored.wav 7215236be51cc86f319488b7f446e451fb16fa7033e733dc6b89fe383d118535
copy_voice SAY_OHBOYANOTHERWIZARD.wav tutorial-oh-boy-another-wizard.wav 5d0ce3e49383bade90aa7ffea491be6cb11eb10e9c1c4f417976faa8b631c45f
copy_voice SAY_IHAVEBEENDISPATCHED.wav tutorial-been-dispatched.wav edaa508a9cf3fc6dc79714d0166934a7985964225d611435600500a61d830587
copy_voice SAY_ILLDOTHEDISPATCHING.wav tutorial-do-the-dispatching.wav 5925f54d7a924941cabdb97204b332a8c634ff980adaccd0c79b26f063902b36
copy_voice SAY_YOURPERVERSIONS.wav tutorial-your-perversions.wav 9faf1b8da6df4fbec57beaa6213c724d5b88f9d8db2092dd8eed6082e4c6fa92
copy_voice SAY_TODEATHEXACTLY.wav tutorial-to-death-exactly.wav d92e6cbbd0aad5d8784da89712e9d0e810a6fd8bfa1278dbaf9a23ac1298ee9c
copy_voice SAY_COWARDCOMEBACK.wav tutorial-coward-come-back.wav e524548ebad58e35e20cdb87ce3c6c41e58c596807fcb1a799e0630772793605
copy_voice ARCH_INTRO_0.wav arch-intro-0.wav b819a5aa7397df964ec9f9e03149941450d65d10fe207f71c3643419fd071255

printf 'Extracted 5 native game tracks, the complete right-click WAV bank, the College Office loop, and 23 voice lines.\n'
