# Third-party showcase assets

The Web Lua showcase mods use ordinary human-made asset packs. No generative-AI
image, texture, model, animation, music, or sound is included.

The machine-readable download URLs, selected paths and SHA-256 values live in
[`asset-sources.json`](asset-sources.json). The source ZIP files are build inputs
and are not checked into this repository or shipped inside mod packages. Only
the selected files and deterministic derived PNGs are packaged.

## Kenney Game Icons 1.0

- Author and distributor: Kenney
- Source: <https://kenney.nl/assets/game-icons>
- License: [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archive SHA-256: `7a86d8d58e0b851e22004b3c70bf90b003632bbf9ac633424daa3bb17d9e7e4e`

The archive license permits personal and commercial use without attribution.
The showcase documentation still credits Kenney because it helps learners find
the original pack.

## Kenney RPG Audio 1.0

- Author and distributor: Kenney
- Source: <https://kenney.nl/assets/rpg-audio>
- License: [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archive SHA-256: `6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b`

The selected Ogg files cover a book/UI cue, a door, coins, and a metal impact.

## Quaternius Ultimate Animated Character Pack

- Author and distributor: Quaternius
- Source: <https://quaternius.com/packs/ultimatedanimatedcharacter.html>
- License: [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Selected source file: `Zombie_Male.blend`
- Source SHA-256: `9fe152e29dfea9c86e76ee13551b4331a99209c4ad4d42243aa7767466dcba7f`

The pack contains more than 50 animated characters in Blend, FBX, OBJ and glTF
formats. The selected Blend file contains one rigged mesh and 17 animation
actions, including Idle, Run, Punch and Death. The checked-in workflow renders
those actions into a transparent multi-heading sprite sheet.

## Loopable Dungeon Ambience

- Author: JaggedStone
- Source: <https://opengameart.org/content/loopable-dungeon-ambience>
- License: [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Selected file: `dungeon_ambient_1.ogg`
- File SHA-256: `df491823e4877371c34dbda4e9321cd83a4a14fa7573cee0ebca1ae423b70e6e`

This human-made loop combines low wind and water drips. Monument Crypt uses it
as quiet room music; the original OpenGameArt page identifies it as loopable.

## Redistribution rule

If an archive URL or checksum changes, inspect the new archive and its license
before updating `asset-sources.json`. Never silently accept a changed download.
The asset fetch command fails closed on a SHA mismatch.
