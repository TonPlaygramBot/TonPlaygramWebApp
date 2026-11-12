// @types/three re-exports meshoptimizer/decoder, an export-map-only subpath.
// The app's legacy Node resolver cannot follow it; the package root exposes
// the same decoder contract under both Node and Bundler resolution.
declare module 'three/examples/jsm/libs/meshopt_decoder.module.js' {
  export const MeshoptDecoder: typeof import('meshoptimizer').MeshoptDecoder;
}
