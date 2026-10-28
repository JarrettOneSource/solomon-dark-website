export const GAME_WEBSOCKET_COMPRESSION = Object.freeze({
  clientNoContextTakeover: true,
  concurrencyLimit: 4,
  serverNoContextTakeover: true,
  threshold: 1_024,
  zlibDeflateOptions: Object.freeze({
    // Avoid a main-thread round trip for every 16 KiB of a burst snapshot or
    // owner checkpoint while the authoritative simulation is busy.
    chunkSize: 128 * 1_024,
    level: 3,
    memLevel: 7,
  }),
})
