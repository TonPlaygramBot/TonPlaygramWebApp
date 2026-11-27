import * as T from 'three';

/** Positions are in the unmodified Object_48 donor mesh's local coordinates.
 * This purely visual shape is not a damage, collision, or physics model. */
const pocket = new T.Vector3(0.36, 0.68, 0.97);
const radii = new T.Vector3(0.35, 0.24, 0.30);
const maxOffset = new T.Vector3(0, -0.012, -0.061);

export function supportsCompactPanelDent(root: T.Object3D, mesh: T.Mesh, material: T.Material) {
  // Opt into the exact approved paint panel only, not its glass, driver,
  // wheel rig, cabin, or any generalized pattern across other vehicles.
  return root.userData.collectionVehicle === 'golf-gti' && mesh.name === 'Object_48' &&
    root.userData.sha256 === 'a7c8b73910b22fbfa7abbe03d362db4b4565da1986f473383f719bbea6ac62b1' &&
    !root.userData.stopCompactPanelDent &&
    material.name === 'Rojo_Kings_wyf5mjqd' && material instanceof T.MeshStandardMaterial &&
    !(mesh instanceof T.SkinnedMesh) && !mesh.morphTargetInfluences && !material.transparent &&
    material.alphaTest === 0;
}

export function applyCompactPanelDent(material: T.MeshStandardMaterial) {
  const strength = { value: 0 };
  material.onBeforeCompile = shader => {
    if (!shader.vertexShader.includes('#include <beginnormal_vertex>') ||
        !shader.vertexShader.includes('#include <begin_vertex>')) return;
    shader.uniforms.compactDentStrength = strength;
    shader.uniforms.compactDentPocket = { value: pocket };
    shader.uniforms.compactDentRadii = { value: radii };
    shader.uniforms.compactDentMaxOffset = { value: maxOffset };
    shader.vertexShader = `
uniform float compactDentStrength;
uniform vec3 compactDentPocket, compactDentRadii, compactDentMaxOffset;
${shader.vertexShader}
`.replace('#include <beginnormal_vertex>', `
#include <beginnormal_vertex>
vec3 compactDentQ = (position - compactDentPocket) / compactDentRadii;
float compactDentInside = max(0.0, 1.0 - dot(compactDentQ, compactDentQ));
float compactDentWeight = compactDentInside * compactDentInside;
vec3 compactDentGrad = -4.0 * compactDentInside * compactDentQ / compactDentRadii;
vec3 compactDentOffset = compactDentStrength * compactDentMaxOffset;
objectNormal = normalize(objectNormal - compactDentGrad *
  (dot(compactDentOffset, objectNormal) / (1.0 + dot(compactDentGrad, compactDentOffset))));
#ifdef USE_TANGENT
  objectTangent = normalize(objectTangent + compactDentOffset * dot(compactDentGrad, objectTangent));
#endif
`).replace('#include <begin_vertex>', `
#include <begin_vertex>
transformed += compactDentWeight * compactDentOffset;
`);
  };
  material.customProgramCacheKey = () => 'tirana-starter-compact-dent-v1';
  return (value: number) => { strength.value = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)); };
}
