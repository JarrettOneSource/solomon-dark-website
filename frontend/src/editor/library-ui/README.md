# Boneyard shelf presentation

This is the current Website's authoring-shelf presentation, extracted from
`game/native-ui` at `fa08ae249ff5563570bdb2a653e2ef9358ce7b83`. It contains the stock
button plan, native bitmap text and their DOM adapters. It has no game, renderer,
Pixi or simulation dependency.

The catalog retains only the three shelf fonts (`heading`, `medium`, `menu`),
their existing Fonts atlas, and UI button records54,101,102. The two PNG imports
remain the actual existing Website assets. Unused tabs, menus, dialogs, messages,
scene frames, nine-slices and other atlas consumers are omitted.

The fixture records six unchanged Source button plans and five text layouts,
including native box placement and unsupported authored-name characters. Run
`node --experimental-strip-types --test src/editor/library-ui/library-ui.test.ts`
from `frontend`. Browser focus, files, cloud operations and workshop Test are
covered through the actual shelf route rather than by the pure presenter fixture.
