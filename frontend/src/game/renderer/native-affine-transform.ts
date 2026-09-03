export interface MutableNativeAffineMatrix {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

export function writeNativeRotationThenScaleMatrix(
  target: MutableNativeAffineMatrix,
  rotationRadians: number,
  scaleX: number,
  scaleY: number,
  translationX: number,
  translationY: number,
): void {
  const cosine = Math.cos(rotationRadians)
  const sine = Math.sin(rotationRadians)
  target.a = cosine * scaleX
  target.b = sine * scaleY
  target.c = -sine * scaleX
  target.d = cosine * scaleY
  target.tx = translationX
  target.ty = translationY
}
