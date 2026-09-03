# Apprentice Apothecary

This is the beginner Web Lua example. Read
[`scripts/main.lua`](scripts/main.lua) from top to bottom: two named sounds come
first, then one small definition for each feature, then the rules. There is no
`sd.mod` call. The game collects everything the script creates, content refers
to other content by key, and art fields take a path.

The mod adds Moondust, a Ward Tonic, a Survey Orb pickup, one robe affix, a
courtyard shop, a Provokatus Boast with custom icon art, and a Minimap. It
demonstrates the normal path for inventory, statuses, world pickups, reforging,
Boast authority, presentation audio, UI actions, and saved semantic state
without using an advanced reducer.

## Try it locally

From `frontend/`:

```sh
npm run sdmod -- check examples/web-lua/apprentice-apothecary
npm run sdmod -- test examples/web-lua/apprentice-apothecary
npm run sdmod -- pack examples/web-lua/apprentice-apothecary /tmp/apprentice-apothecary.sdmod
```

Upload the resulting `.sdmod` on the Website Mods page, subscribe to it, then
start the game. Pip appears beside the courtyard potion trader. Provokatus's
Boast menu gains a sixth scrollable row containing `EMPTY HANDS, FULL GLORY!`.
Drag the list upward to reach it. The Minimap and Survey Orb appear after
entering a Boneyard.

The PNG icons and Ogg sounds are human-made CC0 assets from Kenney. See
[`ASSETS.md`](ASSETS.md).
