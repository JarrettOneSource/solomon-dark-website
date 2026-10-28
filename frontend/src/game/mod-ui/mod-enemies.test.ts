import assert from 'node:assert/strict'
import test from 'node:test'

import { projectModEnemies } from './mod-enemies.ts'

test('projects a replicated directional enemy frame and sound through trusted assets', () => {
  const image = {
    byteLength: 24,
    contentType: 'image/png',
    kind: 'image',
    modId: 'example.crypt',
    path: 'art/keeper.png',
    sha256: '3'.repeat(64),
  }
  const sound = {
    byteLength: 44,
    contentType: 'audio/wav',
    kind: 'audio',
    modId: image.modId,
    path: 'audio/keeper-hit.wav',
    sha256: '4'.repeat(64),
  }
  assert.equal(projectModEnemies({
    enemies: [{
      current_health: 75,
      frame_height: 192,
      frame_width: 192,
      frame_x: 384,
      frame_y: 0,
      id: 9,
      image_height: 192,
      image_path: image.path,
      image_width: 3072,
      life_state: 'alive',
      light_color: 0x9c7ad9,
      light_radius: 72,
      maximum_health: 100,
      mod_id: image.modId,
      name: 'Grave Keeper',
      scale: 1,
      sound_event_tick: 44,
      sound_path: sound.path,
      sound_volume: 0.7,
      x: 10,
      y: 20,
    }],
  }, [image, sound])[0]?.imageUrl, `/api/game/content/${image.sha256}`)
})
