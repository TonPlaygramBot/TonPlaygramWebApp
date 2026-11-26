import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { addClockPortalPhoto, CLOCK_PORTAL_ASSET } from './clockPortalPhoto';

describe('Tirana Clock Tower west portal photograph', () => {
  it('projects the photo once on the west-facing shaft and preserves original geometry', async () => {
    const clock = new THREE.Group();
    clock.position.set(73.22,0,-23.06);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(6,27,6));
    shaft.position.y=13.5;
    clock.add(shaft);
    const texture = new THREE.Texture(),load = vi.fn(async (_: string) => texture);
    const owned = new Set<THREE.Texture>();
    const panel = await addClockPortalPhoto(clock,owned,()=>false,load);
    expect(load).toHaveBeenCalledExactlyOnceWith(CLOCK_PORTAL_ASSET);
    expect(clock.children).toEqual([shaft,panel]);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(owned.has(texture)).toBe(true);
    expect(panel).toBeInstanceOf(THREE.Mesh);
    if (!panel) throw new Error('Portal panel missing');
    clock.updateMatrixWorld(true);
    const forward = new THREE.Vector3(0,0,1).transformDirection(panel.matrixWorld);
    expect(forward.x).toBeCloseTo(-1);
    expect(new THREE.Box3().setFromObject(panel).max.x).toBeLessThan(clock.position.x - 3);
    expect(new THREE.Box3().setFromObject(panel).min.y).toBeGreaterThan(0);
    expect(panel.material.side).toBe(THREE.FrontSide);
    expect(panel.castShadow).toBe(false);
  });

  it('leaves the tower unchanged on an HTTP/error/decoding failure', async () => {
    const clock = new THREE.Group(),owned = new Set<THREE.Texture>();
    const result=await addClockPortalPhoto(clock,owned,()=>false,async()=>{throw Error('404');});
    expect(result).toBe(null);
    expect(clock.children).toHaveLength(0);
    expect(owned.size).toBe(0);
  });

  it('disposes a late image and does not attach after the route is closed', async () => {
    const clock = new THREE.Group(),owned = new Set<THREE.Texture>(),texture=new THREE.Texture();
    const release=vi.spyOn(texture,'dispose');
    let closed=false;
    const resultPromise=addClockPortalPhoto(clock,owned,()=>closed,async()=>texture);
    closed=true;
    expect(await resultPromise).toBe(null);
    expect(release).toHaveBeenCalledTimes(1);
    expect(clock.children).toHaveLength(0);
    expect(owned.size).toBe(0);
  });
});
