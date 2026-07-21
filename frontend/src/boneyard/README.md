# Browser Boneyard model

The Boneyard workspace has four ownership boundaries:

- `parser.ts` validates the complete recursive SyncBuffer and builds a native
  scene without mutating source bytes.
- `model.ts` is the editor-facing document and scene contract.
- `BoneyardCanvas.tsx` owns only view transforms, drawing, and hit testing.
- `BoneyardViewer.tsx` owns file input and workspace chrome.

The recovered spatial records are:

| Record | Native serialization |
| --- | --- |
| Spawn | `float2 position`, `float direction` |
| World object | first base-object child begins with `float2 position`, `float2 velocity` |
| Road | start/end, UID links, four quad points, style byte, two end scales |
| Fence | start/end, UID links, style byte |
| Terrain | mode/reserved, point array, UID, weight array, scale |
| Ground detail | atlas entry, position, rotation, two scales, flags |

Road, Fence, and Terrain layouts are verified against native virtual Sync
methods `0x0063EAA0`, `0x0063EB70`, and `0x00651720`. World-object base fields
come from `0x00622DC0`; derived type Sync methods preserve their additional
chunks in each `WorldObject`.

An editor writer must update known fields in their original payloads while
preserving every opaque chunk and named buffer. It should not regenerate the
entire file from the rendered scene: triggers, recipes, timelines, and
compatibility fields are intentionally outside the visual scene model.
