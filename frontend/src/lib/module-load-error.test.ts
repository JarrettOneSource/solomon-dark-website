import assert from 'node:assert/strict'
import test from 'node:test'
import { isModuleLoadError } from './module-load-error.ts'

test('recognizes Firefox report and sibling browser and stylesheet load failures', () => {
  for (const message of [
    'error loading dynamically imported module: https://solomondarker.com/assets/ModPowerups-BZKsUtVf.js',
    'Failed to fetch dynamically imported module: https://example.test/assets/Game.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/Boneyard.css',
  ]) assert.equal(isModuleLoadError(new TypeError(message)), true, message)
})

test('ordinary runtime, API, and arbitrary thrown values do not trigger module recovery', () => {
  for (const error of [
    new TypeError('Failed to fetch'),
    new Error('Cannot read properties of undefined'),
    new Error('Mage Air factory emitted a light without native manager registration'),
    null, 'error loading dynamically imported module', { status: 404 },
  ]) assert.equal(isModuleLoadError(error), false)
})
