/** Shared server policy; browser regression tests use these exact directives. */
export const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
    imgSrc: ["'self'", 'blob:', 'data:', 'https:'],
    // ImageBitmapLoader also fetches embedded data-URL textures in glTF assets.
    connectSrc: ["'self'", 'blob:', 'data:', 'https:', 'wss:'],
    // The native/mobile build can load wall videos from the separately
    // hosted API. Without an explicit media policy CSP falls back to
    // default-src 'self' and blocks the player before it reaches Express.
    mediaSrc: ["'self'", 'blob:', 'data:', 'https:'],
    fontSrc: ["'self'", 'data:', 'https:'],
    frameSrc: ["'self'", 'https:'],
    // Three.js Draco/KTX2 decoders use workers created from local Blob URLs.
    // Keep this permission specific to workers, not all script sources.
    workerSrc: ["'self'", 'blob:']
  }
};
