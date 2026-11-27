import * as T from 'three';
import {describe, expect, it} from 'vitest';
import {applyCompactPanelDent, supportsCompactPanelDent} from './compactPanelDent';

describe('Starter compact cosmetic deformation', () => {
  it('is opt-in to the exact existing approved GLB body paint panel', () => {
    const root = new T.Group(), material = new T.MeshStandardMaterial();
    const mesh = new T.Mesh(new T.PlaneGeometry(),material);
    mesh.name = 'Object_48'; material.name = 'Rojo_Kings_wyf5mjqd';
    root.userData = {collectionVehicle:'golf-gti',sha256:'a7c8b73910b22fbfa7abbe03d362db4b4565da1986f473383f719bbea6ac62b1'};
    expect(supportsCompactPanelDent(root,mesh,material)).toBe(true);
    root.userData.sha256='wrong';expect(supportsCompactPanelDent(root,mesh,material)).toBe(false);
    root.userData.sha256='a7c8b73910b22fbfa7abbe03d362db4b4565da1986f473383f719bbea6ac62b1';
    root.userData.stopCompactPanelDent=true;expect(supportsCompactPanelDent(root,mesh,material)).toBe(false);
    root.userData.stopCompactPanelDent=false;
    material.transparent=true;expect(supportsCompactPanelDent(root,mesh,material)).toBe(false);
    material.transparent=false;mesh.name='Rolling-wheel-1';expect(supportsCompactPanelDent(root,mesh,material)).toBe(false);
  });

  it('shares the shader program but not per-instance strengths; changes no geometry or material feature', () => {
    const original = new T.MeshPhysicalMaterial({clearcoat:0.7,map:new T.Texture()});
    const a=original.clone(), b=original.clone();
    const mesh=new T.Mesh(new T.PlaneGeometry(),a);
    const position=mesh.geometry.getAttribute('position');
    const setA=applyCompactPanelDent(a), setB=applyCompactPanelDent(b);
    const renderer={} as T.WebGLRenderer;
    const shader=()=>({uniforms:{} as Record<string,T.IUniform>,fragmentShader:'',vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>'});
    const shaderA=shader(),shaderB=shader();
    a.onBeforeCompile(shaderA,renderer);b.onBeforeCompile(shaderB,renderer);
    setA(25);setB(-25);
    expect(shaderA.uniforms.compactDentStrength.value).toBe(1);
    expect(shaderB.uniforms.compactDentStrength.value).toBe(0);
    setB(0.5);setA(NaN);
    expect(shaderB.uniforms.compactDentStrength.value).toBe(0.5);
    expect(shaderA.uniforms.compactDentStrength.value).toBe(0);
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
    expect(shaderA.vertexShader).toContain('transformed += compactDentWeight * compactDentOffset');
    expect(mesh.geometry.getAttribute('position')).toBe(position);
    expect(a.map).toBe(original.map);
    expect(a.clearcoat).toBe(original.clearcoat);
  });
});
