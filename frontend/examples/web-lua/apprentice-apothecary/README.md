# Apprentice Apothecary

This is the beginner Web Lua example. Read
[`scripts/main.lua`](scripts/main.lua) from top to bottom: assets come first,
then one small definition for each feature, and finally `sd.mod` gathers the
parts into a package.

The mod adds Moondust, a Ward Tonic, a Survey Orb pickup, one robe affix, a
courtyard shop, and a Minimap. It demonstrates the normal path for inventory,
statuses, world pickups, reforging, presentation audio, UI actions, and saved
semantic state without using an advanced reducer.

## Try it locally

From `frontend/`:

```sh
npm run sdmod -- check examples/web-lua/apprentice-apothecary
npm run sdmod -- test examples/web-lua/apprentice-apothecary
npm run sdmod -- pack examples/web-lua/apprentice-apothecary /tmp/apprentice-apothecary.sdmod
```

Upload the resulting `.sdmod` on the Website Mods page, subscribe to it, then
start the game. Pip appears beside the courtyard potion trader. The Minimap and
Survey Orb appear after entering a Boneyard.

The PNG icons and Ogg sounds are human-made CC0 assets from Kenney. See
[`ASSETS.md`](ASSETS.md).
