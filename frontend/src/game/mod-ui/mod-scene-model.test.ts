import assert from 'node:assert/strict'
import test from 'node:test'

import { projectModScene } from './mod-scene-model.ts'

test('projects the selected authoritative room geometry', () => {
  const model = projectModScene({
    scenes: [{
      epoch: 4,
      owner_id: 'run-1',
      room_index: 1,
      rooms: [
        { content_id: '1', geometry: { kind: 'inline' }, name: 'Entry', props: [] },
        {
          content_id: '2',
          description: 'A readable room.',
          geometry: { floor: '#112233', height: 500, walls: [{ height: 20, width: 80, x: 10, y: 20 }], width: 800 },
          name: 'Vault',
          props: [{ kind: 'altar', x: 400, y: 250 }],
        },
      ],
      scene_content_id: '9',
    }],
  }, 'run-1')
  assert.equal(model?.rooms[model.roomIndex]?.name, 'Vault')
  assert.equal(model?.rooms[1]?.walls.length, 1)
})
