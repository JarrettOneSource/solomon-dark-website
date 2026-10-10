// The game's loose surface textures, straight from images/: the five road
// surfaces, the two terrain styles, and the fence grate. Everything the
// stage tiles or strokes comes through here.
//
// Per the native RE (native-asset-system.md, loose-image ownership): roads,
// fencegrate, and river/rise are true world textures; WallTop is a dormant
// stock load nothing renders, so the editor draws walls as the generated
// mesh the game builds. The arena field uses the original full DeadHawg
// atlas: native-arena-field owns mode-selected records 11/12 and their
// fractional UV endpoints. Bonedit always selects record 12.

import fenceGrateUrl from '../assets/game/boneyard/textures/fencegrate.png'
import groundUrl from '../assets/game/boneyard-combat-atlas-2.png'
import riseUrl from '../assets/game/boneyard/textures/rise.png'
import riverUrl from '../assets/game/boneyard/textures/river.png'
import road1Url from '../assets/game/boneyard/textures/road.png'
import road2Url from '../assets/game/boneyard/textures/road2.png'
import road3Url from '../assets/game/boneyard/textures/road3.png'
import road4Url from '../assets/game/boneyard/textures/road4.png'
import road5Url from '../assets/game/boneyard/textures/road5.png'

/** Full 2048-square atlas page; never repeat this page as a ground tile. */
export const GROUND_TEXTURE = groundUrl

/** Road surface per native texture selector 0..4 (road.png .. road5.png). */
export const ROAD_TEXTURES = [road1Url, road2Url, road3Url, road4Url, road5Url]

export const ROAD_STYLE_LABEL = ['Cobbles', 'Pavers', 'Dirt', 'Flags', 'Boards']

/** Terrain style 0 is river, 1 is rise; the game strokes these tiles along
 * the terrain spline. */
export const TERRAIN_TEXTURES = [riverUrl, riseUrl]

export const TERRAIN_STYLE_LABEL = ['River', 'Rise']

/** Fence segment codes 0..4 from the native record. */
export const FENCE_STYLE_LABEL = ['Grate', 'Broken grate', 'Gate', 'Wall', 'Rails']

export const FENCE_GRATE_TEXTURE = fenceGrateUrl

/** Native road half-width in world pixels at width scale 1 (from the 69-byte
 * record's derived quad). */
export const ROAD_HALF_WIDTH = 55
