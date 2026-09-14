import * as THREE from 'three';
declare const BACKGAMMON_PREVIEW_HUMAN: string;
let template: Promise<THREE.Object3D> | null = null;
export function createSeatedHumanModelLibrary() {
  return {
    loadSeatedHumanTemplate: () => {
      if (!template)
        template = (async () => {
          const bytes = Uint8Array.from(atob(BACKGAMMON_PREVIEW_HUMAN), (c) =>
            c.charCodeAt(0)
          );
          const json = await new Response(
            new Blob([bytes])
              .stream()
              .pipeThrough(new DecompressionStream('gzip'))
          ).text();
          return new THREE.ObjectLoader().parse(JSON.parse(json));
        })();
      return template;
    }
  };
}
