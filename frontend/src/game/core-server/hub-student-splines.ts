import type { Vector2 } from '../core-kernels/vector.ts'
import {
  compileNativeNaturalSpline,
  evaluateNativeNaturalSpline,
  type NativeNaturalSpline,
} from '../native-natural-spline.ts'

export interface HubStudentSpline {
  readonly id: number
  readonly points: readonly Vector2[]
}

/** Clean-stock Courtyard QuickSpline control points, region path ids 0..17. */
export const HUB_STUDENT_SPLINES: readonly HubStudentSpline[] = [
  { id: 0, points: [{ x: 1577, y: -29 }, { x: 1550, y: 131 }, { x: 1439, y: 298 }, { x: 1212, y: 524 }, { x: 938, y: 568 }, { x: 787, y: 497 }, { x: 751, y: 386 }, { x: 767, y: 296 }, { x: 803, y: 201 }, { x: 773, y: 135 }, { x: 716, y: 77 }, { x: 663, y: 72 }, { x: 627, y: 74 }, { x: 456, y: 77 }] },
  { id: 1, points: [{ x: 1594, y: -33 }, { x: 1568, y: 140 }, { x: 1489, y: 253 }, { x: 1368, y: 416 }, { x: 1216, y: 617 }, { x: 1105, y: 842 }, { x: 977, y: 954 }, { x: 934, y: 1123 }] },
  { id: 2, points: [{ x: 65, y: 336 }, { x: 167, y: 498 }, { x: 328, y: 654 }, { x: 378, y: 710 }, { x: 424, y: 831 }, { x: 521, y: 874 }, { x: 678, y: 873 }, { x: 934, y: 920 }, { x: 1225, y: 930 }, { x: 1459, y: 926 }, { x: 1656, y: 956 }, { x: 1749, y: 1078 }] },
  { id: 3, points: [{ x: 989, y: 1140 }, { x: 1003, y: 956 }, { x: 1177, y: 845 }, { x: 1471, y: 783 }, { x: 1713, y: 710 }, { x: 1952, y: 576 }, { x: 2048, y: 495 }] },
  { id: 4, points: [{ x: 16, y: 366 }, { x: 90, y: 511 }, { x: 69, y: 652 }, { x: -54, y: 757 }] },
  { id: 5, points: [{ x: 1644, y: -31 }, { x: 1560, y: 292 }, { x: 1572, y: 502 }, { x: 1639, y: 621 }, { x: 1734, y: 666 }, { x: 1874, y: 622 }, { x: 2053, y: 484 }] },
  { id: 6, points: [{ x: 1998, y: 453 }, { x: 1841, y: 567 }, { x: 1717, y: 618 }, { x: 1540, y: 580 }, { x: 1280, y: 568 }, { x: 1148, y: 604 }, { x: 888, y: 623 }, { x: 627, y: 600 }, { x: 349, y: 580 }, { x: 166, y: 509 }, { x: 48, y: 333 }] },
  { id: 7, points: [{ x: -53, y: 814 }, { x: 239, y: 782 }, { x: 367, y: 741 }, { x: 401, y: 668 }, { x: 477, y: 620 }, { x: 638, y: 634 }, { x: 884, y: 669 }, { x: 1073, y: 672 }, { x: 1260, y: 621 }, { x: 1412, y: 442 }, { x: 1530, y: 268 }, { x: 1695, y: -33 }] },
  { id: 8, points: [{ x: 2031, y: 929 }, { x: 1462, y: 888 }, { x: 1221, y: 892 }, { x: 987, y: 904 }, { x: 884, y: 978 }, { x: 873, y: 1116 }] },
  { id: 9, points: [{ x: 895, y: 1121 }, { x: 841, y: 987 }, { x: 549, y: 980 }, { x: 189, y: 977 }, { x: -42, y: 969 }] },
  { id: 10, points: [{ x: 2044, y: 109 }, { x: 1833, y: 137 }, { x: 1634, y: 232 }, { x: 1536, y: 390 }, { x: 1541, y: 547 }, { x: 1626, y: 653 }, { x: 1797, y: 653 }, { x: 2064, y: 487 }] },
  { id: 11, points: [{ x: 848, y: 1133 }, { x: 859, y: 799 }, { x: 821, y: 574 }, { x: 760, y: 415 }, { x: 780, y: 227 }, { x: 778, y: 151 }, { x: 733, y: 95 }, { x: 672, y: 71 }, { x: 608, y: 75 }, { x: 473, y: 77 }] },
  { id: 12, points: [{ x: 1477, y: -49 }, { x: 1453, y: 3 }, { x: 1410, y: 46 }, { x: 1360, y: 59 }, { x: 1327, y: 96 }, { x: 1350, y: 144 }, { x: 1421, y: 224 }, { x: 1412, y: 352 }, { x: 1369, y: 453 }, { x: 1315, y: 510 }, { x: 1231, y: 561 }, { x: 1154, y: 535 }, { x: 1177, y: 448 }, { x: 1193, y: 385 }, { x: 1183, y: 307 }, { x: 1157, y: 241 }, { x: 1101, y: 183 }, { x: 1026, y: 185 }, { x: 974, y: 100 }, { x: 973, y: -44 }] },
  { id: 13, points: [{ x: 918, y: 1149 }, { x: 826, y: 950 }, { x: 719, y: 737 }, { x: 558, y: 599 }, { x: 389, y: 604 }, { x: 241, y: 566 }, { x: 137, y: 470 }, { x: 23, y: 275 }] },
  { id: 14, points: [{ x: 2031, y: 429 }, { x: 1836, y: 576 }, { x: 1614, y: 636 }, { x: 1466, y: 589 }, { x: 1285, y: 590 }, { x: 1048, y: 668 }, { x: 771, y: 649 }, { x: 542, y: 599 }, { x: 371, y: 658 }, { x: 155, y: 736 }, { x: -49, y: 778 }] },
  { id: 15, points: [{ x: 1474, y: -49 }, { x: 1451, y: 3 }, { x: 1412, y: 44 }, { x: 1361, y: 58 }, { x: 1329, y: 96 }, { x: 1352, y: 143 }, { x: 1427, y: 235 }, { x: 1474, y: 415 }, { x: 1508, y: 594 }, { x: 1560, y: 745 }, { x: 1669, y: 901 }, { x: 1799, y: 1075 }] },
  { id: 16, points: [{ x: -35, y: 997 }, { x: 148, y: 868 }, { x: 217, y: 651 }, { x: 126, y: 441 }, { x: 29, y: 293 }] },
  { id: 17, points: [{ x: 1850, y: 1073 }, { x: 1703, y: 887 }, { x: 1602, y: 733 }, { x: 1566, y: 626 }, { x: 1599, y: 501 }, { x: 1592, y: 331 }, { x: 1625, y: 191 }, { x: 1753, y: 80 }, { x: 1878, y: 25 }, { x: 1971, y: 16 }] },
]

export interface CompiledHubStudentSpline extends HubStudentSpline {
  readonly native: NativeNaturalSpline
}

export const COMPILED_HUB_STUDENT_SPLINES: readonly CompiledHubStudentSpline[] = (
  HUB_STUDENT_SPLINES.map((spline) => ({
    ...spline,
    native: compileNativeNaturalSpline(spline.points),
  }))
)

export function evaluateHubStudentSpline(
  splineId: number,
  cursor: number,
): Vector2 {
  const spline = COMPILED_HUB_STUDENT_SPLINES[splineId]
  if (!spline) throw new Error(`unknown Courtyard Student spline ${splineId}`)
  return evaluateNativeNaturalSpline(spline.native, cursor)
}
