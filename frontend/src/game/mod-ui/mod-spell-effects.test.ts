import assert from 'node:assert/strict'
import test from 'node:test'

import { projectModSpellEffects } from './mod-spell-effects.ts'

test('projects trusted spell effect art and audio through content-addressed URLs', () => {
  const image = {
    byteLength: 24,
    contentType: 'image/png',
    kind: 'image',
    modId: 'example.spells',
    path: 'art/orb.png',
    sha256: '1'.repeat(64),
  }
  const sound = {
    byteLength: 44,
    contentType: 'audio/wav',
    kind: 'audio',
    modId: 'example.spells',
    path: 'audio/cast.wav',
    sha256: '2'.repeat(64),
  }
  assert.deepEqual(projectModSpellEffects({
    spell_effects: [{
      frame_height: 32,
      frame_width: 32,
      frame_x: 0,
      frame_y: 0,
      id: 7,
      image_height: 32,
      image_path: image.path,
      image_width: 32,
      kind: 'projectile',
      mod_id: image.modId,
      radius: 8,
      sound_path: sound.path,
      sound_volume: 0.5,
      started_tick: 12,
      target_x: 50,
      target_y: 60,
      x: 10,
      y: 20,
    }],
  }, [image, sound]), [{
    frame: { height: 32, width: 32, x: 0, y: 0 },
    id: 7,
    imageHeight: 32,
    imageUrl: `/api/game/content/${image.sha256}`,
    imageWidth: 32,
    kind: 'projectile',
    radius: 8,
    soundUrl: `/api/game/content/${sound.sha256}`,
    soundVolume: 0.5,
    startedTick: 12,
    targetX: 50,
    targetY: 60,
    x: 10,
    y: 20,
  }])
})
