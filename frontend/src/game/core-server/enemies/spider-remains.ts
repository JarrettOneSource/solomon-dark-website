import { createNativeDeadSpider, stepNativeDeadSpider } from '../../core-kernels/native-dead-spider.ts'
import type { BoneyardEnemyActor, BoneyardSpiderRemains, WorkingStep } from './model.ts'

export function spawnSpiderRemains(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  work.spiderRemains.push({
    id: work.nextDeathEffectId++, spawnTick: tick,
    state: createNativeDeadSpider(actor.position, actor.headingDeg),
  })
}

export function stepSpiderRemains(work: WorkingStep): void {
  const survivors: BoneyardSpiderRemains[] = []
  for (const remains of work.spiderRemains) {
    const result = stepNativeDeadSpider(remains.state, work.steeringRngState)
    work.steeringRngState = result.rngState
    if (result.state !== null) survivors.push({ ...remains, state: result.state })
  }
  work.spiderRemains = survivors
}
