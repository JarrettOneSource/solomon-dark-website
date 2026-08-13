const { contextBridge, ipcRenderer } = require('electron')

const endpoint = ipcRenderer.sendSync('solomon-dark:game-endpoint')
if (!endpoint || (endpoint.kind !== 'localhost' && endpoint.kind !== 'remote')
  || typeof endpoint.url !== 'string' || typeof endpoint.credential !== 'string') {
  throw new Error('Desktop game endpoint is invalid')
}

contextBridge.exposeInMainWorld('solomonDarkRuntime', Object.freeze({
  gameEndpoint: Object.freeze({
    kind: endpoint.kind,
    url: endpoint.url,
    credential: endpoint.credential,
  }),
}))
