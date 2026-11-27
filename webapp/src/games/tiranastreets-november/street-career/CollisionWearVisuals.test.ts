import * as T from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { Effect } from '../shared/engine.mjs';
import { CollisionWearVisuals } from './CollisionWearVisuals';

const event = (id: number, kind: string, cars?: [string, number][], at = 1): Effect => ({
  id, at, kind, x: 0, z: 0, toX: 0, toZ: 0, weapon: '', owner: 'local',
  roadWear: cars?.map(([id, delta]) => ({ id, delta })),
});
function fixture(asset: string, name: string, bike = false) {
  const root = new T.Group(), bodyMaterial = new T.MeshPhysicalMaterial({ map: new T.Texture(), clearcoat: 0.8, color: 0xaaaaaa, roughness: 0.2 });
  root.userData[bike ? 'bikeAsset' : 'collectionVehicle'] = asset;
  bodyMaterial.name = name;
  const panel = new T.Mesh(new T.BoxGeometry(), bodyMaterial);
  panel.name = bike ? 'Frame' : 'PaintPanel';
  const wheel = new T.Group();
  wheel.userData.rollingWheel = true;
  const tire = new T.Mesh(new T.BoxGeometry(), bodyMaterial);
  wheel.add(tire); tire.rotation.x = 0.4;
  root.add(panel, wheel);
  const glassMaterial = new T.MeshPhysicalMaterial({ transparent: true, opacity: 0.3 });
  glassMaterial.name = name;
  const glass = new T.Mesh(new T.BoxGeometry(), glassMaterial);
  root.add(glass);
  return { root, panel, tire, glass, glassMaterial, bodyMaterial };
}
const unlocked = () => false;

describe('Tirana collision wear visuals', () => {
  it('responds only to a current road event with an actual registered vehicle', () => {
    const x = new CollisionWearVisuals();
    const { root, panel, bodyMaterial } = fixture('ford', 'Car_Paint');
    const lookup = (id: string) => id === 'a' ? { id } : undefined;
    const first = [event(1, 'vehicle-explosion', [['a', 18]]), event(2, 'crash'), event(3, 'crash', [['other', 14], ['a', 0.1]])];
    x.update(first, 1.1, lookup, () => root, unlocked);
    x.update([event(4, 'crash', [['a', 18]], 1)], 3.1, lookup, () => root, unlocked);
    expect(panel.material).toBe(bodyMaterial);
    x.update([event(5, 'crash', [['a', 8]], 3.1)], 3.2, lookup, () => root, unlocked);
    expect(panel.material).not.toBe(bodyMaterial);
  });

  it('modifies only original approved exterior paint, keeps texture/geometry/rig, and leaves shared donors untouched', () => {
    const x = new CollisionWearVisuals();
    const { root, panel, tire, glass, glassMaterial, bodyMaterial } = fixture('golf-gti', 'Rojo_Kings_wyf5mjqd');
    const donor = new T.Mesh(panel.geometry, bodyMaterial);
    const first = [event(1, 'crash', [['car', 7]])];
    const vehicles = (id: string) => ({ id, health: 140 });
    x.update(first, 1, vehicles, () => root, unlocked);
    const wear = panel.material as T.MeshPhysicalMaterial;
    expect(wear).not.toBe(bodyMaterial);
    expect(wear.map).toBe(bodyMaterial.map);
    expect(panel.geometry).toBe(donor.geometry);
    expect(donor.material).toBe(bodyMaterial);
    expect(wear.roughness).toBeGreaterThan(bodyMaterial.roughness);
    expect(wear.clearcoat).toBeLessThan(bodyMaterial.clearcoat);
    expect(wear.clearcoat).toBeGreaterThan(0);
    expect(tire.material).toBe(bodyMaterial);
    expect(tire.rotation.x).toBe(0.4);
    expect(glass.material).toBe(glassMaterial);
    const one = wear.roughness;
    x.update(first, 1.2, vehicles, () => root, unlocked);
    expect(wear.roughness).toBe(one);
    x.update([event(2, 'crash', [['car', 12]], 1.25)], 1.25, vehicles, () => root, unlocked);
    expect(panel.material).toBe(wear);
    expect(wear.roughness).toBeGreaterThan(one);
  });

  it('covers bicycle, e-bike, scooter and motorcycle frames; resets and yields to existing wrecks', () => {
    const x = new CollisionWearVisuals();
    const assets = ['city-bicycle', 'mountain-bike', 'delivery-ebike', 'city-scooter', 'street-motorcycle'];
    const fixtures = new Map(assets.map(asset => [asset, fixture(asset, 'Enamel', true)]));
    const strength = assets.map(asset => [asset, 10] as [string, number]);
    const healthy = (id: string) => ({ id, health: 140 });
    const visual = (id: string) => fixtures.get(id)?.root;
    x.update([event(1, 'crash', strength)], 1, healthy, visual, unlocked);
    for (const asset of assets) {
      const { panel, tire, bodyMaterial } = fixtures.get(asset)!;
      expect(panel.material).not.toBe(bodyMaterial);
      expect(tire.material).toBe(bodyMaterial);
    }
    const { panel, bodyMaterial } = fixtures.get('city-bicycle')!;
    const dispose = vi.spyOn(panel.material, 'dispose');
    x.update([], 1.2, id => ({ id, health: id === 'city-bicycle' ? 95 : 140 }), visual, unlocked);
    expect(panel.material).toBe(bodyMaterial);
    expect(dispose).toHaveBeenCalledOnce();
    x.reset();
    for (const { panel, bodyMaterial } of fixtures.values()) expect(panel.material).toBe(bodyMaterial);
  });

  it('caps concurrent wear, restores retired clones and reapplies when an actor streams back', () => {
    const x = new CollisionWearVisuals();
    const fixtures = Array.from({ length: 7 }, () => fixture('ford', 'Car_Paint'));
    const byId = (id: string) => fixtures[Number(id)]?.root;
    const vehicle = (id: string) => ({ id, health: 140 });
    x.update([event(1, 'crash', fixtures.map((_, i) => [String(i), 9]))], 1, vehicle, byId, unlocked);
    expect(fixtures.filter(f => f.panel.material !== f.bodyMaterial)).toHaveLength(6);
    const retired = fixtures[6];
    fixtures[6] = fixture('ford', 'Car_Paint');
    x.update([], 1.2, vehicle, byId, unlocked);
    expect(retired.panel.material).toBe(retired.bodyMaterial);
    expect(fixtures[6].panel.material).not.toBe(fixtures[6].bodyMaterial);
  });
});
