export function actorHeadingFromVector(x: number, y: number): number {
  const degrees = Math.atan2(x, -y) * 180 / Math.PI
  return (degrees + 360) % 360
}

export function actorHeadingIndex(heading: number): number {
  const normalized = ((heading % 360) + 360) % 360
  return Math.floor((normalized + 7.5) / 15) % 24
}

export function actorHeadingVector(headingIndex: number): { x: number; y: number } {
  const radians = headingIndex * 15 * Math.PI / 180
  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
  }
}
