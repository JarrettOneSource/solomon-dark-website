import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

const [output] = process.argv.slice(2)
assert.ok(output, 'usage: node tools/check-mod-quickbar-browser.mjs OUTPUT')
const root = fileURLToPath(new URL('../', import.meta.url))
const harness = `
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ModSkillQuickbar from './src/game/mod-ui/ModSkillQuickbar.tsx';
window.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
const counts = { adds: 0, removes: 0 };
const originalAdd = window.addEventListener.bind(window);
const originalRemove = window.removeEventListener.bind(window);
window.addEventListener = (type, ...args) => { if (type === 'keydown') counts.adds++; originalAdd(type, ...args); };
window.removeEventListener = (type, ...args) => { if (type === 'keydown') counts.removes++; originalRemove(type, ...args); };
function check(value, text) { if (!value) throw new Error(text); }
function session(id) {
 let runtime = { mod_quickbar: [], spells: [] };
 const listeners = new Set();
 const casts = [];
 return { playerId: id, modAssets: [], casts, listeners,
  getModRuntime: () => runtime,
  onModRuntime: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot: () => ({ players: { [id]: { headingIndex: 0, position: { x: 10, y: 20 } } } }),
  castModSpell: (contentId, target) => casts.push({ contentId, target }),
  setRuntime: next => { runtime = next; for (const listener of listeners) listener(next); },
 };
}
const row = (slot, id) => ({ mod_quickbar: [{ slot, content_id: id }], spells: [{ content_id: id, name: id }] });
const key = (value, extra = {}) => {
 const event = new KeyboardEvent('keydown', { key: value, shiftKey: true, cancelable: true, ...extra });
 window.dispatchEvent(event); return event.defaultPrevented;
};
window.runQuickbarAcceptance = async () => {
 const first = session('first'), second = session('second');
 await act(async () => root.render(React.createElement(ModSkillQuickbar, { session: first })));
 for (let i = 0; i < 50; i++) await act(async () => first.setRuntime({ mod_quickbar: [], spells: [], revision: i }));
 check(counts.adds === 0 && counts.removes === 0, 'empty quickbar installed a keyboard listener');
 await act(async () => first.setRuntime(row(0, 'first-spell')));
 check(counts.adds === 1 && counts.removes === 0, 'nonempty mount listener count');
 for (let i = 0; i < 100; i++) await act(async () => first.setRuntime(row(1, 'updated-' + i)));
 check(counts.adds === 1 && counts.removes === 0, 'runtime update reinstalled the listener');
 check(!key('1'), 'stale binding was consumed');
 check(key('2'), 'current binding was not consumed');
 check(first.casts.length === 1 && first.casts[0].contentId === 'updated-99', 'listener used stale spell data');
 for (const extras of [{ shiftKey: false }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { repeat: true }]) key('2', extras);
 check(first.casts.length === 1, 'modifier or repeat admission changed');
 second.setRuntime(row(0, 'second-spell'));
 await act(async () => root.render(React.createElement(ModSkillQuickbar, { session: second })));
 check(first.listeners.size === 0 && second.listeners.size === 1, 'session subscription lifetime incorrect');
 check(counts.adds === 2 && counts.removes === 1, 'session keyboard lifetime incorrect');
 check(key('1') && second.casts[0]?.contentId === 'second-spell', 'session switch retained old binding');
 await act(async () => second.setRuntime({ mod_quickbar: [], spells: [] }));
 check(counts.removes === 2, 'empty transition failed to detach');
 await act(async () => second.setRuntime(row(2, 'third-spell')));
 check(counts.adds === 3, 'empty-to-nonempty transition did not attach');
 await act(async () => root.unmount());
 check(counts.removes === 3 && second.listeners.size === 0, 'unmount leaked listener/subscription');
 check(!key('3'), 'unmounted binding still consumed input');
 return { passed: true, emptyUpdates: 50, nonemptyUpdates: 100, counts,
   firstCasts: first.casts, secondCasts: second.casts, oldSessionSubscribers: first.listeners.size, newSessionSubscribers: second.listeners.size };
};
`
const bundle = await build({ stdin: { contents: harness, resolveDir: root, sourcefile: 'quickbar-acceptance.jsx', loader: 'jsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"development"' } })
const script = bundle.outputFiles[0].text
const server = createServer((request, response) => {
  if (request.url === '/test.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(script); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><div id="root"></div><script src="/test.js"></script>'); }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false })
  const page = await browser.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.waitForFunction(() => typeof window.runQuickbarAcceptance === 'function')
  const result = await page.evaluate(() => window.runQuickbarAcceptance())
  assert.deepEqual(errors, [])
  const receipt = { atUtc: new Date().toISOString(), browser: browser.version(), ...result, errors,
    scope: 'Actual React component mount, runtime updates, keyboard dispatch, session replacement and unmount in headed Mac Chrome.' }
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt))
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
