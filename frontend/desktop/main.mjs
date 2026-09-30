import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session } from 'electron'
import electronUpdater from 'electron-updater'

import { startStaticClientServer } from './static-client-server.mjs'
import { checkLaunchUpdate } from './updates.mjs'

const READINESS_TIMEOUT_MS = 10_000
const SHUTDOWN_TIMEOUT_MS = 3_000
const ENDPOINT_CHANNEL = 'solomon-dark:game-endpoint'
let clientServer
let gameHost
let quitting = false

const DESKTOP_ORIGIN = 'sdr://desktop'
protocol.registerSchemesAsPrivileged([{
  scheme: 'sdr',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}])
app.setName('Solomon Darker')
app.setAppUserModelId('com.solomondarker.desktop')
if (process.env.SDR_DESKTOP_USER_DATA) app.setPath('userData', resolve(process.env.SDR_DESKTOP_USER_DATA))
app.commandLine.appendSwitch('enable-gpu-rasterization')

// Closing the app also closes its authoritative server, including on macOS.
app.on('window-all-closed', () => { if (!quitting) app.quit() })
app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void shutdown().finally(() => app.quit())
})

void app.whenReady().then(start).catch(async (error) => {
  console.error(error)
  quitting = true
  await shutdown()
  dialog.showErrorBox('Solomon Darker could not start', error.message)
  app.exit(1)
})

async function start() {
  const applicationRoot = app.getAppPath()
  const resources = app.isPackaged ? process.resourcesPath : applicationRoot
  const clientRoot = resolve(process.env.SDR_DESKTOP_CLIENT_ROOT || join(resources, 'client'))
  clientServer = await startStaticClientServer({ root: clientRoot })
  // Keep IndexedDB and localStorage independent of the ephemeral TCP port.
  protocol.handle('sdr', (request) => {
    if (!isDesktopUrl(request.url) || !['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 403 })
    }
    const url = new URL(request.url)
    return net.fetch(`${clientServer.origin}${url.pathname}${url.search}`, { method: request.method })
  })
  const endpoint = desktopRemoteEndpoint() ?? await startLocalGameHost(resources, DESKTOP_ORIGIN)
  const preload = resolve(applicationRoot, 'preload.cjs')
  await access(preload)

  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  Menu.setApplicationMenu(null)
  const window = new BrowserWindow({
    backgroundColor: '#000000',
    height: 800,
    minHeight: 600,
    minWidth: 960,
    show: false,
    title: 'Solomon Darker',
    width: 1280,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
      sandbox: true,
      webSecurity: true,
    },
  })
  const provideEndpoint = (event) => {
    const frame = event.senderFrame
    event.returnValue = event.sender === window.webContents
      && frame === window.webContents.mainFrame && isDesktopUrl(frame.url)
      ? { ...endpoint, desktop: {
          version: app.getVersion(),
          signalingUrl: process.env.SDR_DESKTOP_SIGNALING_URL || 'wss://solomondarker.com/desktop-signal',
        } }
      : null
  }
  ipcMain.on(ENDPOINT_CHANNEL, provideEndpoint)
  window.once('closed', () => ipcMain.off(ENDPOINT_CHANNEL, provideEndpoint))
  const gameUrl = `${DESKTOP_ORIGIN}/game`
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!isDesktopUrl(url)) event.preventDefault()
  })
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.once('ready-to-show', () => window.show())
  await window.loadURL(gameUrl)
  if (app.isPackaged && process.env.SDR_DESKTOP_SKIP_UPDATE_CHECK !== '1') {
    void checkLaunchUpdate({
      updater: electronUpdater.autoUpdater,
      ask: (options) => dialog.showMessageBox(window, options),
      beforeInstall: async () => { quitting = true; await shutdown() },
    })
  }
}

function isDesktopUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'sdr:' && url.hostname === 'desktop'
      && !url.port && !url.username && !url.password
  } catch {
    return false
  }
}

async function startLocalGameHost(applicationRoot, origin) {
  const node = resolve(process.env.SDR_DESKTOP_NODE || join(applicationRoot, 'runtime', nodeExecutable()))
  const hostEntry = resolve(process.env.SDR_DESKTOP_GAME_HOST || join(applicationRoot, 'game-host', 'game-host.mjs'))
  await Promise.all([access(node), access(hostEntry)])
  const credential = randomBytes(32).toString('base64url')
  gameHost = spawn(node, [hostEntry], {
    env: {
      ...(process.platform === 'win32' && process.env.SystemRoot
        ? { SystemRoot: process.env.SystemRoot }
        : {}),
      SDR_GAME_ALLOWED_ORIGINS: origin,
      SDR_GAME_BOOTSTRAP_CREDENTIAL: credential,
      SDR_GAME_HOST: '127.0.0.1',
      SDR_GAME_PORT: '0',
      SDR_GAME_SNAPSHOT_RATE: '20',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const ready = await hostReadiness(gameHost)
  gameHost.once('exit', (code, signal) => {
    if (!quitting) {
      console.error(`Local game host exited (${code ?? signal ?? 'unknown'})`)
      app.quit()
    }
  })
  return { kind: 'localhost', sessionKind: 'standalone', url: ready.url, credential }
}

function desktopRemoteEndpoint() {
  const configured = process.env.SDR_DESKTOP_REMOTE_ENDPOINT_JSON
  if (!configured) return null
  const endpoint = JSON.parse(configured)
  if (endpoint?.kind !== 'remote' || typeof endpoint.url !== 'string'
    || typeof endpoint.credential !== 'string') {
    throw new Error('SDR_DESKTOP_REMOTE_ENDPOINT_JSON is invalid')
  }
  return endpoint
}

function hostReadiness(child) {
  return new Promise((resolveReady, reject) => {
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => fail(new Error('Local game host readiness timed out')), READINESS_TIMEOUT_MS)
    const receive = (chunk) => {
      stdout += chunk
      if (stdout.length > 64 * 1024) {
        fail(new Error('Local game host emitted excessive readiness output'))
        return
      }
      const newline = stdout.indexOf('\n')
      if (newline < 0) return
      try {
        const message = JSON.parse(stdout.slice(0, newline))
        const url = typeof message.url === 'string' ? new URL(message.url) : null
        if (message.type !== 'ready' || url?.protocol !== 'ws:'
          || url.hostname !== '127.0.0.1' || url.pathname !== '/game'
          || url.username || url.password) {
          throw new Error('Local game host emitted invalid readiness data')
        }
        cleanup()
        child.stdout.resume()
        resolveReady(message)
      } catch (error) {
        fail(error)
      }
    }
    const fail = (error) => {
      cleanup()
      reject(new Error(`${error.message}${stderr ? `: ${stderr.trim()}` : ''}`))
    }
    const exited = (code, signal) => fail(new Error(`Local game host exited before readiness (${code ?? signal})`))
    const cleanup = () => {
      clearTimeout(timeout)
      child.stdout.off('data', receive)
      child.off('error', fail)
      child.off('exit', exited)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8192) })
    child.stdout.on('data', receive)
    child.once('error', fail)
    child.once('exit', exited)
  })
}

async function shutdown() {
  for (const window of BrowserWindow.getAllWindows()) window.destroy()
  await Promise.allSettled([
    stopChild(gameHost),
    clientServer?.close(),
  ])
  gameHost = undefined
  clientServer = undefined
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolveStop) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }, SHUTDOWN_TIMEOUT_MS)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    child.kill('SIGTERM')
  })
}

function nodeExecutable() {
  return process.platform === 'win32' ? 'node.exe' : 'node'
}
