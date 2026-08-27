export function nativeDirectEnvironmentLightAlpha(now: number, playerIndex: number): number {
  const flicker = (Math.sin(now * 0.017 + playerIndex * 2.399) + 1) / 2
  return 0.2375 + flicker * 0.0125
}
