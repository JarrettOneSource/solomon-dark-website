# Monument Crypt

This advanced example combines a selectable Boneyard, monument portal,
party-owned room scene, custom directional enemy, music, spells, and scoped
reducers. It is still one readable Lua file; the engine owns networking, saves,
collision, transactions, scene suspension, replication, and teardown.

The Grave Keeper PNG was rendered from Quaternius's human-made CC0 animated
Zombie Male model. [`grave-keeper.render.json`](art/grave-keeper.render.json)
is the editable recipe. See the complete [3D-to-2D
workflow](../../../../docs/web-lua-3d-to-2d-art.md).

From `frontend/`:

```sh
npm run sdmod -- assets fetch
npm run sdmod -- render-sprite examples/web-lua/monument-crypt/art/grave-keeper.render.json
npm run sdmod -- check examples/web-lua/monument-crypt
npm run sdmod -- test examples/web-lua/monument-crypt
npm run sdmod -- pack examples/web-lua/monument-crypt /tmp/monument-crypt.sdmod
```

Upload and subscribe on the Website, choose Monument Approach in the Boneyard
picker, and begin the run. Walk to a monument and choose **Enter Monument
Crypt**. The leader controls room changes and Return; guests see the same saved
scene epoch, room, reducers, enemy state, animation heading, and audio owners.

All external assets are human-made and CC0. [`ASSETS.md`](ASSETS.md) travels
with the package and credits Quaternius, Kenney, and JaggedStone.
