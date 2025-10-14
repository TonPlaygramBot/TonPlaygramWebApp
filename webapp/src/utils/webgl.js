export function isWebGLAvailable() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return true;
  }

  try {
    const canvas = document.createElement('canvas');
    const contexts = ['webgl2', 'webgl', 'experimental-webgl'];
    for (const ctx of contexts) {
      const gl = canvas.getContext(ctx);
      if (gl && typeof gl.getParameter === 'function') {
        return true;
      }
    }
  } catch (err) {
    console.warn('WebGL capability check failed', err);
    return false;
  }

  return false;
}
