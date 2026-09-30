import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDesktopRelease } from './desktop-releases.ts'
import { peerDescription, peerIceServers } from './peer-negotiation.ts'

test('download catalog offers only actual uploaded installers at the canonical release host', () => {
  const release = parseDesktopRelease({
    tag_name: 'v0.1.0', draft: false, prerelease: false,
    assets: [
      { name: 'Solomon-Darker-Setup-x64.exe', state: 'uploaded', size: 123, browser_download_url: 'https://untrusted.example/run.exe' },
      { name: 'Solomon-Darker-arm64.dmg', state: 'new', size: 0 },
      { name: 'other.exe', state: 'uploaded', size: 123 },
    ],
  })
  assert.equal(release.version, '0.1.0')
  assert.deepEqual(release.assets.map(asset => asset.url), [
    'https://github.com/JarrettOneSource/solomon-dark-website/releases/download/v0.1.0/Solomon-Darker-Setup-x64.exe',
  ])
})

test('draft, prerelease, malformed and empty releases do not masquerade as downloads', () => {
  for (const value of [null, {}, { tag_name: 'v0.1.0', draft: true, prerelease: false, assets: [] },
    { tag_name: 'v0.1.0', draft: false, prerelease: false, assets: [] },
    { tag_name: '../bad', draft: false, prerelease: false, assets: [] }]) {
    assert.throws(() => parseDesktopRelease(value))
  }
})

test('peer negotiation accepts bounded ICE and rejects other URL schemes and malformed SDP', () => {
  assert.deepEqual(peerIceServers([{ urls: 'stun:example.org:3478' }]), [{ urls: ['stun:example.org:3478'] }])
  assert.throws(() => peerIceServers([{ urls: 'https://untrusted.example' }]))
  assert.throws(() => peerIceServers(Array(9).fill({ urls: 'stun:example.org' })))
  assert.throws(() => peerDescription({ type: 'rollback', sdp: '' }))
  assert.deepEqual(peerDescription({ type: 'offer', sdp: 'v=0' }), { type: 'offer', sdp: 'v=0' })
})
