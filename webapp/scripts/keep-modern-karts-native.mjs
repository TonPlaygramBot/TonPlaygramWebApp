// The authored Racing GLBs use a fixed query in the actual game loader.
const MODERN_KART_LOCAL_PATH = /^assets\/kart-royale\/karts\/(?:apex|oobi|oodi|ooli|oopi|photon|vortex|aegis)(?:-lod)?\.glb$/u;
export function keepModernKartBundled(localRelativePath) {
  return typeof localRelativePath === 'string' && MODERN_KART_LOCAL_PATH.test(localRelativePath);
}
