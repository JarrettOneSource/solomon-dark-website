# 3D models to Web Lua sprite sheets

The showcase art workflow turns an ordinary animated FBX character into a
transparent 2D sheet. It uses Blender in background mode and never calls an AI
image service.

## Commands

From `frontend/`:

```sh
npm run sdmod -- assets fetch
npm run sdmod -- render-sprite examples/web-lua/monument-crypt/art/grave-keeper.render.json
```

`assets fetch` downloads the archives listed in
`examples/web-lua/asset-sources.json` into the user cache. Existing bytes are
accepted only when their SHA-256 matches. Changed downloads fail and require a
human license/content review.

`render-sprite` locates Blender through `SDR_BLENDER_PATH` or `blender`, loads
one JSON recipe, renders every requested animation and heading, and writes one
PNG beside the recipe.

## Recipe

```json
{
  "source": "quaternius-ultimate-animated-character-2019-zombie-male",
  "blend": "Zombie_Male.blend",
  "output": "grave-keeper.png",
  "frameSize": 192,
  "headings": 16,
  "camera": {
    "azimuthOffset": 0,
    "elevation": 58,
    "orthographicScale": 4.4
  },
  "animations": [
    {
      "name": "idle",
      "action": "Idle",
      "frames": [0, 25, 50, 75]
    },
    {
      "name": "move",
      "action": "Run",
      "frames": [0, 4, 8, 12, 16, 20]
    },
    {
      "name": "attack",
      "action": "Punch",
      "frames": [0, 6, 12, 18]
    },
    {
      "name": "death",
      "action": "Death",
      "frames": [0, 18, 36, 55]
    }
  ]
}
```

Paths are relative to the selected source archive, except `output`, which is
relative to the recipe. The recipe is data rather than Blender Python so a
learner normally changes only filenames, frame numbers, camera values and
output size.

## Sheet layout

- Columns are clockwise headings.
- Column zero faces south, matching the Website world-camera convention.
- Rows are animation samples in recipe order.
- Every cell is a square `frameSize` by `frameSize` PNG region.
- The background is transparent and lighting/camera/color management are fixed.

Web Lua declares the result with the same row numbers:

```lua
local keeper = sd.art.sheet({
  image = "art/grave-keeper.png",
  frame = { width = 192, height = 192 },
  headings = 16,
  animations = {
    idle = { 1, 2, 3, 4 },
    move = { 5, 6, 7, 8, 9, 10 },
    attack = { 11, 12, 13, 14 },
    death = { 15, 16, 17, 18 },
  },
})
```

When `headings` is present, animation numbers mean sheet rows. The renderer
chooses the heading column. Without `headings`, animation numbers retain the
ordinary flat frame-index meaning.

## Animation import

The Quaternius Blend file stores its mesh, armature, flat-color materials, and
animation actions together. The workflow finds the exact action named in each
recipe row. For an FBX-only model, import/retarget it once in Blender and save a
self-contained Blend file before writing the recipe; the command does not guess
how unrelated skeletons should be retargeted.

## Determinism

The workflow fixes:

- Blender startup scene and render engine;
- transparent film and RGBA PNG output;
- camera projection and light positions;
- color-management transform, exposure and gamma;
- model origin, scale and rotation;
- frame/heading iteration order;
- output dimensions and PNG settings.

The command prints source, recipe and output SHA-256 values. The checked-in
receipt records the pinned Blender version and expected output digest. A
deliberate Blender upgrade requires regenerating the sheet, reviewing the
contact sheet, and updating that receipt.

## Choosing frames

Open the source clip in Blender only when the defaults look wrong. Start with
four idle frames and four to six movement/attack frames. More frames cost memory
and download time; they do not automatically look better at game scale.

Render 8 headings for small background actors and 16 for a normal enemy. Use 24
only when the art must align with the player actor headings. Keep one consistent
heading count for every animation in a sheet.
