export const GAME_WEBSOCKET_COMPRESSION = Object.freeze({
  clientNoContextTakeover: true,
  concurrencyLimit: 4,
  serverNoContextTakeover: true,
  threshold: 1_024,
  zlibDeflateOptions: Object.freeze({
    level: 3,
    memLevel: 7,
  }),
})
