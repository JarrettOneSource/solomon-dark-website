import type { HubSegment } from './hub-collision.ts'
import type { NativeHubFixedActorPainterId } from './native-hub-world-membership.ts'
import type { Vector2 } from './vector.ts'

export const HUB_PRIVATE_ROOM_IDS = [
  'mortuary',
  'library',
  'storeroom',
  'office',
] as const

export type PrivateHubRegionId = typeof HUB_PRIVATE_ROOM_IDS[number]

export type HubPrivateRoomAsset =
  | 'library-background'
  | 'library-props'
  | 'mortuary-background'
  | 'mortuary-paintings'
  | 'office-background'
  | 'office-prop'
  | 'storeroom-background'
  | 'storeroom-props'

export interface HubRoomCircleCollider {
  kind: 'circle'
  position: Vector2
  radius: number
}

export interface HubRoomArchitectureDefinition {
  collider: {
    kind: 'segments'
    segments: readonly HubSegment[]
    tableToWorldOffset: Vector2
  }
  visual: {
    asset: HubPrivateRoomAsset
    kind: 'background'
  }
}

export interface HubRoomActorDefinition {
  collider: HubRoomCircleCollider
  visual: {
    kind: 'arch-chancellor' | 'dowser' | 'librarian' | 'memorator'
    painterY: number
    position: Vector2
  }
}

export type HubRoomPropVisual =
  | {
      asset: 'mortuary-paintings'
      frameIndex: number
      kind: 'portrait'
      marker: boolean
      painterY: number
      position: Vector2
    }
  | {
      asset: 'library-props' | 'storeroom-props'
      frameIndex: number
      kind: 'room-frame'
      painterY: number
    }
  | {
      asset: 'office-prop'
      kind: 'room-layer'
      painterY: number
    }

export interface HubRoomPropDefinition {
  collider: HubRoomCircleCollider
  id: string
  painterId: NativeHubFixedActorPainterId
  visual: HubRoomPropVisual | null
}

export interface HubPrivateRoomLayoutDefinition {
  actors: Readonly<Record<string, HubRoomActorDefinition>>
  architecture: HubRoomArchitectureDefinition
  height: number
  id: PrivateHubRegionId
  nativeId: 1 | 2 | 3 | 4
  props: readonly HubRoomPropDefinition[]
  width: number
}

const MORTUARY_SEGMENT_COORDINATES = [
  [882, 908, 866, 354],
  [866, 354, 808, 346],
  [808, 346, 717, 283],
  [717, 283, 694, 241],
  [694, 241, 693, 214],
  [693, 214, 275, 213],
  [275, 213, 277, 241],
  [277, 241, 253, 282],
  [253, 282, 164, 346],
  [164, 346, 105, 360],
  [105, 360, 85, 916],
] as const

const STOREROOM_SEGMENT_COORDINATES = [
  [586, 718, 587, 614],
  [587, 614, 981, 614],
  [981, 614, 975, 508],
  [975, 508, 987, 368],
  [987, 368, 962, 360],
  [962, 360, 962, 161],
  [962, 161, 849, 156],
  [849, 156, 628, 172],
  [628, 172, 445, 164],
  [445, 164, 289, 169],
  [289, 169, 193, 158],
  [193, 158, 118, 175],
  [118, 175, 112, 344],
  [112, 344, 87, 476],
  [87, 476, 89, 617],
  [89, 617, 485, 617],
  [485, 617, 485, 714],
  [895, 525, 178, 525],
  [178, 525, 175, 483],
  [175, 483, 895, 479],
  [895, 479, 895, 525],
  [887, 403, 174, 403],
  [174, 403, 174, 367],
  [174, 367, 887, 367],
  [887, 367, 887, 403],
  [886, 296, 637, 291],
  [637, 291, 423, 290],
  [423, 290, 279, 309],
  [279, 309, 178, 305],
  [178, 305, 183, 254],
  [183, 254, 421, 255],
  [421, 255, 773, 259],
  [773, 259, 881, 253],
  [881, 253, 886, 296],
] as const

const OFFICE_SEGMENT_COORDINATES = [
  [498, 870, 496, 819],
  [496, 819, 544, 749],
  [544, 749, 698, 742],
  [698, 742, 752, 699],
  [752, 699, 751, 600],
  [751, 600, 809, 600],
  [809, 600, 808, 482],
  [808, 482, 752, 483],
  [752, 483, 700, 474],
  [700, 474, 671, 451],
  [671, 451, 633, 449],
  [633, 449, 593, 413],
  [593, 413, 552, 414],
  [552, 414, 546, 438],
  [546, 438, 523, 449],
  [523, 449, 473, 454],
  [473, 454, 447, 430],
  [447, 430, 444, 408],
  [444, 408, 381, 407],
  [381, 407, 370, 437],
  [370, 437, 341, 436],
  [341, 436, 316, 429],
  [316, 429, 266, 397],
  [266, 397, 214, 427],
  [214, 427, 185, 406],
  [185, 406, 168, 411],
  [168, 411, 168, 426],
  [168, 426, 130, 437],
  [130, 437, 80, 418],
  [80, 418, 74, 479],
  [74, 479, 10, 482],
  [10, 482, 13, 590],
  [13, 590, 65, 597],
  [65, 597, 70, 707],
  [70, 707, 123, 753],
  [123, 753, 263, 758],
  [263, 758, 314, 817],
  [314, 817, 309, 877],
  [348, 639, 487, 639],
  [487, 639, 525, 629],
  [525, 629, 536, 606],
  [536, 606, 536, 574],
  [536, 574, 523, 542],
  [523, 542, 312, 542],
  [312, 542, 300, 571],
  [300, 571, 300, 608],
  [300, 608, 314, 631],
  [314, 631, 349, 639],
] as const

const LIBRARY_SEGMENT_COORDINATES = [
  [929, 783, 921, 542],
  [921, 542, 892, 529],
  [892, 529, 812, 529],
  [812, 529, 710, 515],
  [710, 515, 659, 512],
  [659, 512, 583, 521],
  [583, 521, 582, 537],
  [582, 537, 409, 535],
  [409, 535, 407, 516],
  [407, 516, 70, 512],
  [70, 512, 63, 787],
  [63, 785, 376, 784],
  [376, 784, 376, 906],
  [930, 782, 613, 781],
  [613, 781, 612, 898],
  [826, 671, 668, 671],
  [668, 671, 668, 617],
  [668, 617, 824, 617],
  [824, 617, 824, 668],
  [320, 617, 320, 567],
  [320, 567, 166, 567],
  [166, 567, 166, 617],
  [166, 617, 320, 617],
  [301, 724, 301, 674],
  [301, 674, 145, 674],
  [145, 674, 145, 724],
  [145, 724, 301, 724],
] as const

const MORTUARY_PAINTINGS = [
  { marker: false, portraitId: 0, x: 512, y: 697 },
  { marker: true, portraitId: 1, x: 350, y: 683 },
  { marker: true, portraitId: 2, x: 673, y: 683 },
  { marker: true, portraitId: 3, x: 744, y: 540 },
  { marker: false, portraitId: 4, x: 590, y: 540 },
  { marker: true, portraitId: 5, x: 434, y: 540 },
  { marker: true, portraitId: 6, x: 279, y: 540 },
  { marker: false, portraitId: 7, x: 354, y: 400 },
  { marker: false, portraitId: 8, x: 512, y: 400 },
  { marker: true, portraitId: 9, x: 670, y: 400 },
] as const

const MORTUARY_TABLE_TO_WORLD_OFFSET = { x: 27, y: 57 } as const
const STOREROOM_TABLE_TO_WORLD_OFFSET = { x: 0, y: 72.5 } as const
const LIBRARY_TABLE_TO_WORLD_OFFSET = { x: 16, y: 102.5 } as const
const OFFICE_TABLE_TO_WORLD_OFFSET = { x: 102.5, y: 102.5 } as const

function circle(x: number, y: number, radius: number): HubRoomCircleCollider {
  return { kind: 'circle', position: { x, y }, radius }
}

function segments(
  values: readonly (readonly [number, number, number, number])[],
  tableToWorldOffset: Vector2,
): readonly HubSegment[] {
  return values.map(([x1, y1, x2, y2]) => ({
    x1: x1 + tableToWorldOffset.x,
    y1: y1 + tableToWorldOffset.y,
    x2: x2 + tableToWorldOffset.x,
    y2: y2 + tableToWorldOffset.y,
  }))
}

/**
 * Authoritative fixed-room placement shared by presentation and simulation.
 * Visual and collider positions remain distinct where the native registrations
 * use different roots; neither is inferred from opaque pixels.
 */
export const HUB_PRIVATE_ROOM_LAYOUTS = {
  mortuary: {
    actors: {
      memorator: {
        collider: circle(628, 770, 25),
        visual: {
          kind: 'memorator',
          painterY: 770,
          position: { x: 628, y: 770 },
        },
      },
    },
    architecture: {
      collider: {
        kind: 'segments',
        segments: segments(MORTUARY_SEGMENT_COORDINATES, MORTUARY_TABLE_TO_WORLD_OFFSET),
        tableToWorldOffset: MORTUARY_TABLE_TO_WORLD_OFFSET,
      },
      visual: { asset: 'mortuary-background', kind: 'background' },
    },
    height: 1024,
    id: 'mortuary',
    nativeId: 1,
    props: MORTUARY_PAINTINGS.map(({ marker, portraitId, x, y }) => ({
      collider: circle(x, y - 2, 40),
      id: `painting-${portraitId}`,
      painterId: `mortuary-custom-${portraitId}` as const,
      visual: {
        asset: 'mortuary-paintings' as const,
        frameIndex: portraitId,
        kind: 'portrait' as const,
        marker,
        painterY: y - 2,
        position: { x, y: y + 5 },
      },
    })),
    width: 1024,
  },
  library: {
    actors: {
      librarian: {
        collider: circle(512, 595, 55),
        visual: {
          kind: 'librarian',
          painterY: 595,
          position: { x: 512, y: 538 },
        },
      },
      dowser: {
        collider: circle(900, 642.5, 25),
        visual: {
          kind: 'dowser',
          painterY: 642.5,
          position: { x: 900, y: 642.5 },
        },
      },
    },
    architecture: {
      collider: {
        kind: 'segments',
        segments: segments(LIBRARY_SEGMENT_COORDINATES, LIBRARY_TABLE_TO_WORLD_OFFSET),
        tableToWorldOffset: LIBRARY_TABLE_TO_WORLD_OFFSET,
      },
      visual: { asset: 'library-background', kind: 'background' },
    },
    height: 1024,
    id: 'library',
    nativeId: 2,
    props: [
      {
        collider: circle(239.5, 788, 40),
        id: 'library-prop-0',
        painterId: 'library-custom-0',
        visual: {
          asset: 'library-props', frameIndex: 0, kind: 'room-frame', painterY: 788,
        },
      },
      {
        collider: circle(258.5, 678.5, 40),
        id: 'library-prop-1',
        painterId: 'library-custom-1',
        visual: {
          asset: 'library-props', frameIndex: 1, kind: 'room-frame', painterY: 678.5,
        },
      },
      {
        collider: circle(762, 732.5, 40),
        id: 'library-prop-2',
        painterId: 'library-custom-2',
        visual: {
          asset: 'library-props', frameIndex: 2, kind: 'room-frame', painterY: 732.5,
        },
      },
      {
        collider: circle(831, 620.5, 40),
        id: 'library-prop-3',
        painterId: 'library-custom-100',
        // Native collision object with no matching ordinary prop-atlas selector.
        visual: null,
      },
    ],
    width: 1024,
  },
  storeroom: {
    actors: {},
    architecture: {
      collider: {
        kind: 'segments',
        segments: segments(STOREROOM_SEGMENT_COORDINATES, STOREROOM_TABLE_TO_WORLD_OFFSET),
        tableToWorldOffset: STOREROOM_TABLE_TO_WORLD_OFFSET,
      },
      visual: { asset: 'storeroom-background', kind: 'background' },
    },
    height: 800,
    id: 'storeroom',
    nativeId: 3,
    props: [
      {
        collider: circle(538, 324, 40),
        id: 'storeroom-prop-0',
        painterId: 'storeroom-custom-0',
        visual: {
          asset: 'storeroom-props', frameIndex: 0, kind: 'room-frame', painterY: 324,
        },
      },
      {
        collider: circle(537.5, 434, 40),
        id: 'storeroom-prop-1',
        painterId: 'storeroom-custom-1',
        visual: {
          asset: 'storeroom-props', frameIndex: 1, kind: 'room-frame', painterY: 434,
        },
      },
      {
        collider: circle(536, 542.5, 40),
        id: 'storeroom-prop-2',
        painterId: 'storeroom-custom-2',
        visual: {
          asset: 'storeroom-props', frameIndex: 2, kind: 'room-frame', painterY: 542.5,
        },
      },
    ],
    width: 1075,
  },
  office: {
    actors: {
      'arch-chancellor': {
        collider: circle(514, 467, 55),
        visual: {
          kind: 'arch-chancellor',
          painterY: 467,
          position: { x: 518, y: 412 },
        },
      },
    },
    architecture: {
      collider: {
        kind: 'segments',
        segments: segments(OFFICE_SEGMENT_COORDINATES, OFFICE_TABLE_TO_WORLD_OFFSET),
        tableToWorldOffset: OFFICE_TABLE_TO_WORLD_OFFSET,
      },
      visual: { asset: 'office-background', kind: 'background' },
    },
    height: 1024,
    id: 'office',
    nativeId: 4,
    props: [
      {
        collider: circle(517.5, 681, 40),
        id: 'office-prop-0',
        painterId: 'office-custom-0',
        visual: { asset: 'office-prop', kind: 'room-layer', painterY: 681 },
      },
    ],
    width: 1024,
  },
} as const satisfies Readonly<Record<PrivateHubRegionId, HubPrivateRoomLayoutDefinition>>
