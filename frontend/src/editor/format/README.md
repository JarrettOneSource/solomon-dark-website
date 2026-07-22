# Boneyard format layer

`boneyard.ts` is the dependency-free browser port of the lossless Python
reference implementation in `Website/tools/boneyard_author.py`.

## Public API

```ts
parseBoneyard(bytes: Uint8Array): BoneyardDoc
serializeBoneyard(doc: BoneyardDoc): Uint8Array
newBoneyard(name: string, fixture: Uint8Array): BoneyardDoc
```

The file uses erasable TypeScript syntax only. Node 22 can import it with
`--experimental-strip-types`; the browser build needs no binary-format
dependency.

## Model shape

```text
BoneyardDoc
  meta
    name
    bounds                 left/top/right/bottom plus x/y/w/h aliases
    header                 Arena flags, named aliases, compatibility bytes
    raw.file               complete donor/source file as base64
    raw.arenaSections      original Arena section chunks as base64
  objects                  PlacedObject[]
  roads                    BoneyardRoad[]
  fences                   BoneyardFence[]
  terrain                  BoneyardTerrain[]
  sprites                  BoneyardStaticSprite[]
  recipes
    monsters               MonsterRecipe[]
    items                  RawRecipe[]
    npcs                   RawRecipe[]
    itemSets               RawRecipe[]
    uidGroups              UidGroupRecipe[]
  timeline.records         default or imported TimeLine subtrees
  geometry                 player spawn, facing, layout flag, raw sections
  opaque                   editor compatibility view of preserved subtrees
```

Every entity parsed from a native file retains `raw`, containing its complete
encoded SyncChunk or chunk subtree as base64. `meta.raw.file` supplies the
unknown Arena and RegionLayout envelope fields. Serialization requires that
source or a fixture-derived document.

## Invariants

- Integers and floats are little-endian.
- World units are pixels, with origin at upper left and positive Y downward.
- Arena bounds are not a placement clip. Stock records can lie outside them.
- A decoded section 0 placeable has three direct chunks: common A, common B,
  and the concrete class payload.
- Unchanged records roundtrip byte-for-byte, including noncanonical Boolean
  bytes, ignored flag bits, and unknown child chunks.
- An undecoded or preserve-only record requires `raw`.
- New files clone the pinned blank fixture. They retain its TriggerControl and
  default TimeLine and empty all authorable content managers.
- New UIDs are allocated above both stock content and the fixture TimeLine
  range. `0xFFFFFFFF` remains the absent-link sentinel.

## Authorable fields

The format layer encodes edits and raw-free new records for:

- Arena name, bounds, `arenaRuleMode`, `sessionFlag`, and `environmentMode`;
- player spawn, spawn facing, and the one-byte layout flag;
- Tree 2001, Monument 2009, Gravestone 2029, Building 2040, and Goodie 2061;
- Road 3004, Fence 3005, and Terrain 3009;
- RegionLayout section 11 static sprites;
- MonsterRecipe 6001; and
- UIDGroup 6002.

ItemRecipe 6003, NPCRecipe 6004, ItemSet 6005, TriggerControl, unknown native
types, and TimeLine bytecode are preserve-only. A TimeLine is transplanted as
its raw subtree, not regenerated from event semantics. Serializers reject a
TimeLine whose displayed metadata no longer matches its raw subtree.

## Atlas and alias rules

Placed-object `atlasEntry`, `secondaryAtlasEntry`, `overlayAtlasEntry`, and
`atlasEntries` are computed global DeadHawg records for browser rendering.

Static-sprite `atlasEntry` is different. It is the serialized compact type 0
through 30. The global image record is:

```text
deadHawgEntry = 114 + atlasEntry
```

`rotationDeg`, `scale`, and `alpha` are the real section 11 scalar names.
Properties `s0`, `s1`, and `s2` remain present as aliases for the parallel
editor integration:

```text
s0 = rotationDeg
s1 = scale
s2 = alpha
```

New static sprites use `s0: 0`, `s1: 1`, `s2: 1`, and `flags: 0`. Flag bit 0
compresses X scale to 80 percent; bit 1 halves RGB. Other bits are ignored by
the retail renderer but remain preserved.

Fence `segmentCode` is the native field name. `style` is retained as the
Polyline-model alias. `startPostVariant` and `endPostVariant` are optional
Fencepost selectors, not linked UIDs.

## Regeneration and verification

Run from the workspace root:

```bash
python3 "Solomon Dark/Website/tools/boneyard_author.py" parse \
  "Solomon Dark/SolomonDarkAbandonware/data/levels/story0.boneyard" \
  -o /tmp/story0.json

python3 "Solomon Dark/Website/tools/boneyard_author.py" build \
  /tmp/story0.json -o /tmp/story0.boneyard

python3 "Solomon Dark/Website/tools/boneyard_author.py" roundtrip

python3 "Solomon Dark/Website/tools/boneyard_author.py" new \
  --name "My Boneyard" -o /tmp/my-boneyard.boneyard

python3 "Solomon Dark/Mod Loader/tools/inspect_boneyard.py" \
  /tmp/my-boneyard.boneyard

node --experimental-strip-types \
  "Solomon Dark/Website/tools/check_boneyard_ts.mjs"

cd "Solomon Dark/Website/frontend"
npx tsc --noEmit
```

With no file arguments, both roundtrip checkers cover shipped story, survival,
tutorial, sandbox play, the pinned fixture, and the captured stock-editor save
under `sandbox/DarkCloud/mylevels`.
