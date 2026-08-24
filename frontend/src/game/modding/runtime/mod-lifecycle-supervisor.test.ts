import assert from 'node:assert/strict'
import test from 'node:test'

import { ModLifecycleSupervisor } from './mod-lifecycle-supervisor.ts'

test('lifecycle closes children and owned resources in reverse creation order', () => {
  const closed: string[] = []
  const supervisor = new ModLifecycleSupervisor()
  const root = supervisor.root('example.mod')
  const run = root.child('run', 'run-1')
  const entity = run.child('entity', 'enemy-1')
  run.own('timer', 'run-timer', ({ reason }) => closed.push(`run:${reason}`))
  entity.own('projectile', 'first', ({ reason }) => closed.push(`first:${reason}`))
  entity.own('projectile', 'second', ({ reason }) => closed.push(`second:${reason}`))

  assert.equal(run.close('run-ended'), true)
  assert.deepEqual(closed, ['second:run-ended', 'first:run-ended', 'run:run-ended'])
  assert.equal(entity.alive, false)
  assert.equal(run.close('again'), false)
  assert.equal(root.diagnostic().childCount, 0)
})

test('cleanup failures are logged and cannot retain siblings', () => {
  const closed: string[] = []
  const logs: string[] = []
  const supervisor = new ModLifecycleSupervisor(message => logs.push(message))
  const scope = supervisor.root('example.mod').child('scene', 'crypt')
  scope.own('audio', 'bad', () => { throw new Error('device lost') })
  scope.own('ui', 'good', () => closed.push('good'))

  scope.close('scene-replaced')
  assert.deepEqual(closed, ['good'])
  assert.equal(logs.length, 1)
  assert.match(logs[0]!, /audio:bad: device lost/)
  assert.equal(scope.diagnostic().resourceCount, 0)
})

test('released leases and stale scopes reject duplicate work', () => {
  let releases = 0
  const supervisor = new ModLifecycleSupervisor()
  const root = supervisor.root('example.mod')
  const status = root.child('status', 'invincible')
  const lease = status.own('presentation', 'ring', () => { releases += 1 })

  assert.equal(lease.release(), true)
  assert.equal(lease.release(), false)
  assert.equal(releases, 1)
  status.close('expired')
  assert.throws(() => status.child('timer', 'late'), /stale/)
  assert.throws(() => status.own('audio', 'late', () => {}), /stale/)
})

test('root lookup is idempotent while live and allocates a fresh root after close', () => {
  const supervisor = new ModLifecycleSupervisor()
  const first = supervisor.root('example.mod')
  const same = supervisor.root('example.mod')
  assert.equal(first.id, same.id)
  first.close('unloaded')
  const replacement = supervisor.root('example.mod')
  assert.equal(replacement.id, first.id)
  assert.equal(replacement.alive, true)
})
