import { MeshSimple, type Container, type MeshGeometry, type Texture } from 'pixi.js'

import { destroyOwnedMeshGeometry } from './destroy-owned-mesh-geometry.ts'
import { setNativeVertexColors } from './native-material-batch.ts'

export interface NativeDeathEffectMeshSample {
  blendMode: 'add' | 'normal'
  color: number
  texture: Texture
  readonly vertices: Float32Array
  zIndex: number
}

interface DeathEffectMeshRun {
  activeQuads: number
  readonly capacity: number
  readonly colors: Uint32Array
  readonly geometry: MeshGeometry
  readonly indices: Uint32Array
  readonly mesh: MeshSimple
  readonly vertices: Float32Array
}

/** World-local quads arrive in the Region planner's final draw order. */
export class NativeDeathEffectMeshRuns {
  private activeRunCount = 0
  private readonly root: Container
  private readonly runs: DeathEffectMeshRun[] = []
  private readonly starts: number[] = []

  constructor(root: Container) { this.root = root }

  update(samples: readonly NativeDeathEffectMeshSample[]): void {
    this.starts.length = 0
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index]!
      const previous = samples[index - 1]
      // A depth gap belongs to another painter, including static bands/proxies.
      if (!previous || current.zIndex !== previous.zIndex + 1
        || current.texture !== previous.texture || current.blendMode !== previous.blendMode) {
        this.starts.push(index)
      }
    }
    for (let index = 0; index < this.starts.length; index += 1) {
      const start = this.starts[index]!
      const end = this.starts[index + 1] ?? samples.length
      const first = samples[start]!
      const run = this.ensureRun(index, end - start, first.texture)
      run.mesh.texture = first.texture
      run.mesh.blendMode = first.blendMode
      run.mesh.zIndex = first.zIndex
      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        writeSample(run, sampleIndex - start, samples[sampleIndex]!)
      }
      updateActiveQuads(run, end - start)
      run.geometry.getBuffer('aPosition').update()
      run.geometry.getBuffer('aColor').update()
      run.mesh.renderable = true
    }
    for (let index = this.starts.length; index < this.activeRunCount; index += 1) {
      this.runs[index]!.mesh.renderable = false
    }
    this.activeRunCount = this.starts.length
  }

  setRenderable(renderable: boolean): void {
    for (let index = 0; index < this.activeRunCount; index += 1) {
      this.runs[index]!.mesh.renderable = renderable
    }
  }

  destroy(): void {
    for (const run of this.runs) {
      run.mesh.destroy()
      destroyOwnedMeshGeometry(run)
    }
    this.runs.length = 0
    this.starts.length = 0
    this.activeRunCount = 0
  }

  private ensureRun(index: number, count: number, texture: Texture): DeathEffectMeshRun {
    let run = this.runs[index]
    if (run && run.capacity >= count) return run
    if (run) {
      run.mesh.destroy()
      destroyOwnedMeshGeometry(run)
    }
    const capacity = 2 ** Math.ceil(Math.log2(count))
    const vertices = new Float32Array(capacity * 8)
    const uvs = new Float32Array(capacity * 8)
    const indices = new Uint32Array(capacity * 6)
    const colors = new Uint32Array(capacity * 4)
    for (let quad = 0; quad < capacity; quad += 1) {
      uvs.set([0, 0, 1, 0, 1, 1, 0, 1], quad * 8)
    }
    const mesh = new MeshSimple({ texture, vertices, uvs, indices, topology: 'triangle-list' })
    // These runs use the native batch material even after exceeding Pixi's 100-vertex auto limit.
    mesh.geometry.batchMode = 'batch'
    mesh.label = `enemy-death-effect-mesh-run:${index}`
    mesh.eventMode = 'none'
    mesh.autoUpdate = false
    setNativeVertexColors(mesh, colors)
    this.root.addChild(mesh)
    run = { activeQuads: 0, capacity, colors, geometry: mesh.geometry, indices, mesh, vertices }
    this.runs[index] = run
    return run
  }
}

function writeSample(run: DeathEffectMeshRun, quad: number, sample: NativeDeathEffectMeshSample): void {
  run.vertices.set(sample.vertices, quad * 8)
  const color = sample.color
  const colorOffset = quad * 4
  run.colors[colorOffset] = color
  run.colors[colorOffset + 1] = color
  run.colors[colorOffset + 2] = color
  run.colors[colorOffset + 3] = color
}

function updateActiveQuads(run: DeathEffectMeshRun, count: number): void {
  const previous = run.activeQuads
  if (count === previous) return
  for (let quad = previous; quad < count; quad += 1) {
    const vertex = quad * 4
    run.indices.set([vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3], quad * 6)
  }
  if (count < previous) run.indices.fill(0, count * 6, previous * 6)
  run.geometry.indexBuffer.update(Math.max(count, previous) * 6 * Uint32Array.BYTES_PER_ELEMENT)
  run.activeQuads = count
}
