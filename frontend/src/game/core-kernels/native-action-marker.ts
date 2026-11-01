/** Retail 00410E40, restricted to the action clock's increasing progress domain. */
export function nativeActionMarkerCrossed(previous: number, next: number, marker: number): boolean {
  return next > previous && previous <= marker && marker <= next
}
