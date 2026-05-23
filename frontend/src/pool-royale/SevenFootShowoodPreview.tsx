import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

export type TableKey = 'snooker9ft' | 'showood7ft';
type ClothKey = 'tournamentGreen' | 'royalBlue';
type FinishKey = 'cueWoodWalnut' | 'cueWoodBlack' | 'cueWoodChestnut';
type BaseShapeKey = 'openPortal' | 'classicBlock' | 'twinPedestal';
type PocketId = 'topLeft' | 'topMiddle' | 'topRight' | 'bottomLeft' | 'bottomMiddle' | 'bottomRight';
type CushionId = 'topLeft' | 'topMiddle' | 'topRight' | 'leftTop' | 'leftBottom' | 'rightTop' | 'rightBottom' | 'bottomLeft' | 'bottomMiddle' | 'bottomRight';
type PocketMap = { id: PocketId; center: { x: number; z: number }; radius: number; jawInset: number };
type CushionMap = { id: CushionId; from: { x: number; z: number }; to: { x: number; z: number }; normal: { x: number; z: number }; restitution: number };
type TableMapping = { name: string; sizeFt: '7ft' | '9ft'; playfield: { width: number; length: number; cornerCut: number }; pockets: PocketMap[]; cushions: CushionMap[] };

export const TABLES: Record<TableKey, { title: string; subtitle: string; mapping: TableMapping }> = {
  snooker9ft: {
    title: '9ft Snooker Table',
    subtitle: 'Full-size competitive table with its own 9ft mapping.',
    mapping: { name: 'Snooker 9ft precise mapping', sizeFt: '9ft', playfield: { width: 2.54, length: 1.27, cornerCut: 0.145 }, pockets: [
      { id: 'topLeft', center: { x: -1.15, z: -0.58 }, radius: 0.069, jawInset: 0.04 }, { id: 'topMiddle', center: { x: 0, z: -0.62 }, radius: 0.056, jawInset: 0.03 }, { id: 'topRight', center: { x: 1.15, z: -0.58 }, radius: 0.069, jawInset: 0.04 },
      { id: 'bottomLeft', center: { x: -1.15, z: 0.58 }, radius: 0.069, jawInset: 0.04 }, { id: 'bottomMiddle', center: { x: 0, z: 0.62 }, radius: 0.056, jawInset: 0.03 }, { id: 'bottomRight', center: { x: 1.15, z: 0.58 }, radius: 0.069, jawInset: 0.04 },
    ], cushions: [
      { id: 'topLeft', from: { x: -0.95, z: -0.605 }, to: { x: -0.18, z: -0.63 }, normal: { x: 0, z: 1 }, restitution: 0.92 }, { id: 'topMiddle', from: { x: -0.09, z: -0.635 }, to: { x: 0.09, z: -0.635 }, normal: { x: 0, z: 1 }, restitution: 0.91 }, { id: 'topRight', from: { x: 0.18, z: -0.63 }, to: { x: 0.95, z: -0.605 }, normal: { x: 0, z: 1 }, restitution: 0.92 },
      { id: 'leftTop', from: { x: -1.21, z: -0.47 }, to: { x: -1.24, z: -0.08 }, normal: { x: 1, z: 0 }, restitution: 0.9 }, { id: 'leftBottom', from: { x: -1.24, z: 0.08 }, to: { x: -1.21, z: 0.47 }, normal: { x: 1, z: 0 }, restitution: 0.9 }, { id: 'rightTop', from: { x: 1.21, z: -0.47 }, to: { x: 1.24, z: -0.08 }, normal: { x: -1, z: 0 }, restitution: 0.9 },
      { id: 'rightBottom', from: { x: 1.24, z: 0.08 }, to: { x: 1.21, z: 0.47 }, normal: { x: -1, z: 0 }, restitution: 0.9 }, { id: 'bottomLeft', from: { x: -0.95, z: 0.605 }, to: { x: -0.18, z: 0.63 }, normal: { x: 0, z: -1 }, restitution: 0.92 }, { id: 'bottomMiddle', from: { x: -0.09, z: 0.635 }, to: { x: 0.09, z: 0.635 }, normal: { x: 0, z: -1 }, restitution: 0.91 }, { id: 'bottomRight', from: { x: 0.18, z: 0.63 }, to: { x: 0.95, z: 0.605 }, normal: { x: 0, z: -1 }, restitution: 0.92 },
    ] },
  },
  showood7ft: {
    title: '7ft Showood Table',
    subtitle: 'Compact Showood table with independent 7ft geometry mapping.',
    mapping: { name: 'Showood 7ft precise mapping', sizeFt: '7ft', playfield: { width: 1.98, length: 0.99, cornerCut: 0.12 }, pockets: [
      { id: 'topLeft', center: { x: -0.9, z: -0.45 }, radius: 0.063, jawInset: 0.034 }, { id: 'topMiddle', center: { x: 0, z: -0.48 }, radius: 0.053, jawInset: 0.028 }, { id: 'topRight', center: { x: 0.9, z: -0.45 }, radius: 0.063, jawInset: 0.034 },
      { id: 'bottomLeft', center: { x: -0.9, z: 0.45 }, radius: 0.063, jawInset: 0.034 }, { id: 'bottomMiddle', center: { x: 0, z: 0.48 }, radius: 0.053, jawInset: 0.028 }, { id: 'bottomRight', center: { x: 0.9, z: 0.45 }, radius: 0.063, jawInset: 0.034 },
    ], cushions: [
      { id: 'topLeft', from: { x: -0.72, z: -0.47 }, to: { x: -0.15, z: -0.49 }, normal: { x: 0, z: 1 }, restitution: 0.92 }, { id: 'topMiddle', from: { x: -0.08, z: -0.495 }, to: { x: 0.08, z: -0.495 }, normal: { x: 0, z: 1 }, restitution: 0.91 }, { id: 'topRight', from: { x: 0.15, z: -0.49 }, to: { x: 0.72, z: -0.47 }, normal: { x: 0, z: 1 }, restitution: 0.92 },
      { id: 'leftTop', from: { x: -0.95, z: -0.36 }, to: { x: -0.975, z: -0.06 }, normal: { x: 1, z: 0 }, restitution: 0.9 }, { id: 'leftBottom', from: { x: -0.975, z: 0.06 }, to: { x: -0.95, z: 0.36 }, normal: { x: 1, z: 0 }, restitution: 0.9 }, { id: 'rightTop', from: { x: 0.95, z: -0.36 }, to: { x: 0.975, z: -0.06 }, normal: { x: -1, z: 0 }, restitution: 0.9 },
      { id: 'rightBottom', from: { x: 0.975, z: 0.06 }, to: { x: 0.95, z: 0.36 }, normal: { x: -1, z: 0 }, restitution: 0.9 }, { id: 'bottomLeft', from: { x: -0.72, z: 0.47 }, to: { x: -0.15, z: 0.49 }, normal: { x: 0, z: -1 }, restitution: 0.92 }, { id: 'bottomMiddle', from: { x: -0.08, z: 0.495 }, to: { x: 0.08, z: 0.495 }, normal: { x: 0, z: -1 }, restitution: 0.91 }, { id: 'bottomRight', from: { x: 0.15, z: 0.49 }, to: { x: 0.72, z: 0.47 }, normal: { x: 0, z: -1 }, restitution: 0.92 },
    ] },
  },
};

const CLOTH_PRESETS: Record<ClothKey, { label: string; color: string }> = { tournamentGreen: { label: 'Procedural Cloth · Tournament Green', color: '#0f6f34' }, royalBlue: { label: 'Procedural Cloth · Royal Blue', color: '#0f4cb3' } };
const FINISH_PRESETS: Record<FinishKey, { label: string; color: string; metalness: number; roughness: number }> = { cueWoodWalnut: { label: 'Cue Finish · Walnut', color: '#553118', metalness: 0.08, roughness: 0.43 }, cueWoodBlack: { label: 'Cue Finish · Piano Black', color: '#141414', metalness: 0.22, roughness: 0.28 }, cueWoodChestnut: { label: 'Cue Finish · Chestnut', color: '#6b3f20', metalness: 0.08, roughness: 0.46 } };
const BASE_SHAPES: Record<BaseShapeKey, { label: string }> = { openPortal: { label: 'Open Portal Base' }, classicBlock: { label: 'Classic Block Base' }, twinPedestal: { label: 'Twin Pedestal Base' } };

function proceduralClothTexture(renderer: THREE.WebGLRenderer, tint: string) { const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d'); if (!ctx) return null; ctx.fillStyle = tint; ctx.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 4) { const a = 0.03 + ((y / 256) % 1) * 0.02; ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(0, y, 256, 2); } const t = new THREE.CanvasTexture(canvas); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; }
function proceduralCueWoodTexture(renderer: THREE.WebGLRenderer, tint: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 6) {
    const alpha = 0.07 + ((x / canvas.width) % 1) * 0.06;
    ctx.fillStyle = `rgba(255,185,120,${alpha.toFixed(3)})`;
    ctx.fillRect(x, 0, 2, canvas.height);
  }
  for (let i = 0; i < 180; i += 1) {
    const y = Math.random() * canvas.height;
    const w = 30 + Math.random() * 120;
    const h = 1 + Math.random() * 2;
    ctx.fillStyle = `rgba(45,20,8,${(0.04 + Math.random() * 0.09).toFixed(3)})`;
    ctx.fillRect(Math.random() * (canvas.width - w), y, w, h);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}


export default function SevenFootShowoodPreview({ selectedTable, onBack }: { selectedTable: TableKey; onBack: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [cloth, setCloth] = useState<ClothKey>('tournamentGreen');
  const [finish, setFinish] = useState<FinishKey>('cueWoodWalnut');
  const [topRailFinish, setTopRailFinish] = useState<FinishKey>('cueWoodWalnut');
  const [baseShape, setBaseShape] = useState<BaseShapeKey>('openPortal');
  const currentMapping = useMemo(() => TABLES[selectedTable].mapping, [selectedTable]);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#020202');
    const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 80); camera.position.set(0, 2.2, 2.2); camera.lookAt(0, 0.2, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(host.clientWidth, host.clientHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); host.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1.8, 3.2, 2); scene.add(key);
    const tableGroup = new THREE.Group(); scene.add(tableGroup);
    const scale = currentMapping.sizeFt === '9ft' ? 1.22 : 1;
    const cueTexture = proceduralCueWoodTexture(renderer, FINISH_PRESETS[finish].color);
    const topRailTexture = proceduralCueWoodTexture(renderer, FINISH_PRESETS[topRailFinish].color);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: cueTexture, metalness: FINISH_PRESETS[finish].metalness, roughness: FINISH_PRESETS[finish].roughness });
    const railMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: topRailTexture, metalness: FINISH_PRESETS[topRailFinish].metalness, roughness: FINISH_PRESETS[topRailFinish].roughness });
    const tableBody = new THREE.Mesh(new THREE.BoxGeometry(currentMapping.playfield.width * scale * 1.08, 0.28, currentMapping.playfield.length * scale * 1.12), bodyMat); tableBody.position.y = -0.12; tableGroup.add(tableBody);

    const railTop = new THREE.Mesh(new THREE.BoxGeometry(currentMapping.playfield.width * scale * 1.12, 0.045, currentMapping.playfield.length * scale * 1.16), railMat);
    railTop.position.y = 0.045;
    tableGroup.add(railTop);

    if (baseShape === 'openPortal') {
      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.42, 0.2 * scale), bodyMat);
      leftLeg.position.set(-currentMapping.playfield.width * scale * 0.3, -0.45, 0);
      tableGroup.add(leftLeg);
      const rightLeg = leftLeg.clone();
      rightLeg.position.x = currentMapping.playfield.width * scale * 0.3;
      tableGroup.add(rightLeg);
      const portalBridge = new THREE.Mesh(new THREE.BoxGeometry(currentMapping.playfield.width * scale * 0.7, 0.12, 0.16), bodyMat);
      portalBridge.position.set(0, -0.36, 0);
      tableGroup.add(portalBridge);
      const cutout = new THREE.Mesh(new THREE.BoxGeometry(currentMapping.playfield.width * scale * 0.34, 0.18, 0.14), new THREE.MeshStandardMaterial({ color: '#020202', roughness: 0.9 }));
      cutout.position.set(0, -0.36, 0);
      tableGroup.add(cutout);
    } else if (baseShape === 'classicBlock') {
      const block = new THREE.Mesh(new THREE.BoxGeometry(currentMapping.playfield.width * scale * 0.64, 0.36, currentMapping.playfield.length * scale * 0.42), bodyMat);
      block.position.set(0, -0.42, 0);
      tableGroup.add(block);
    } else {
      const zOff = currentMapping.playfield.length * scale * 0.24;
      [-zOff, zOff].forEach((z) => {
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.38, 20), bodyMat);
        pedestal.position.set(0, -0.42, z);
        tableGroup.add(pedestal);
      });
    }
    const clothTexture = proceduralClothTexture(renderer, CLOTH_PRESETS[cloth].color);
    const clothMesh = new THREE.Mesh(new THREE.PlaneGeometry(currentMapping.playfield.width * scale, currentMapping.playfield.length * scale), new THREE.MeshStandardMaterial({ color: '#ffffff', map: clothTexture, roughness: 0.96, metalness: 0 })); clothMesh.rotation.x = -Math.PI / 2; clothMesh.position.y = 0.03; tableGroup.add(clothMesh);
    currentMapping.pockets.forEach((p) => { const hole = new THREE.Mesh(new THREE.CylinderGeometry(p.radius * scale, p.radius * scale, 0.04, 20), new THREE.MeshStandardMaterial({ color: '#040404' })); hole.rotation.x = -Math.PI / 2; hole.position.set(p.center.x * scale, 0.025, p.center.z * scale); tableGroup.add(hole);
      if (selectedTable === 'showood7ft') {
        const jaw = new THREE.Mesh(new THREE.TorusGeometry(p.radius * scale * 0.92, 0.012 * scale, 10, 28, Math.PI * 1.3), new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.58, metalness: 0.2 }));
        jaw.rotation.x = Math.PI / 2;
        jaw.rotation.z = Math.PI * 0.85;
        jaw.position.set(p.center.x * scale, 0.04, p.center.z * scale);
        tableGroup.add(jaw);
      }
    });

    if (selectedTable === 'showood7ft') {
      currentMapping.cushions.forEach((c) => {
        const dx = c.to.x - c.from.x;
        const dz = c.to.z - c.from.z;
        const len = Math.hypot(dx, dz) * scale;
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: '#ffffff', map: topRailTexture, roughness: 0.52, metalness: 0.12 }));
        const midX = ((c.from.x + c.to.x) / 2) * scale;
        const midZ = ((c.from.z + c.to.z) / 2) * scale;
        cushion.position.set(midX, 0.065, midZ);
        cushion.rotation.y = Math.atan2(dz, dx);
        tableGroup.add(cushion);
      });

      const chromeMat = new THREE.MeshStandardMaterial({ color: '#d5dbea', metalness: 1, roughness: 0.2 });
      const plateW = currentMapping.playfield.width * scale * 0.13;
      const plateD = 0.02;
      const zOff = currentMapping.playfield.length * scale * 0.58;
      const xStep = currentMapping.playfield.width * scale * 0.28;
      [-xStep, 0, xStep].forEach((x) => {
        const topPlate = new THREE.Mesh(new THREE.BoxGeometry(plateW, 0.008, plateD), chromeMat);
        topPlate.position.set(x, 0.03, -zOff);
        tableGroup.add(topPlate);
        const bottomPlate = topPlate.clone();
        bottomPlate.position.z = zOff;
        tableGroup.add(bottomPlate);
      });
    }
    let frame = 0; const animate = () => { frame = requestAnimationFrame(animate); tableGroup.rotation.y += 0.002; renderer.render(scene, camera); }; animate();
    const onResize = () => { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); clothTexture?.dispose(); cueTexture?.dispose(); topRailTexture?.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [cloth, finish, topRailFinish, baseShape, currentMapping, selectedTable]);

  return <main style={{ minHeight: '100vh', background: '#020202', color: 'white', fontFamily: 'system-ui,sans-serif' }}><div ref={hostRef} style={{ position: 'fixed', inset: 0 }} />
    <section style={{ position: 'fixed', top: 8, left: 8, right: 8, background: 'rgba(0,0,0,0.66)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 14, padding: 10 }}>
      <button onClick={onBack} style={{ border: '1px solid rgba(255,255,255,0.35)', borderRadius: 10, color: 'white', background: 'rgba(255,255,255,0.08)', padding: '6px 10px', fontSize: 11 }}>← Back to Lobby</button>
      <div style={{ fontWeight: 900, fontSize: 13, marginTop: 8 }}>{TABLES[selectedTable].title}</div>
      <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>{TABLES[selectedTable].subtitle}</div>
    </section>
    <section style={{ position: 'fixed', left: 8, right: 8, bottom: 8, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 14, padding: 10 }}>
      <div style={{ fontWeight: 900, fontSize: 12 }}>Table Setup Menu ({currentMapping.sizeFt})</div>
      <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
        <label style={{ display: 'grid', gap: 3, fontSize: 11 }}>Table cloth (same on both)<select value={cloth} onChange={(e) => setCloth(e.target.value as ClothKey)}>{(Object.keys(CLOTH_PRESETS) as ClothKey[]).map((k) => <option value={k} key={k}>{CLOTH_PRESETS[k].label}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 3, fontSize: 11 }}>Table finish<select value={finish} onChange={(e) => setFinish(e.target.value as FinishKey)}>{(Object.keys(FINISH_PRESETS) as FinishKey[]).map((k) => <option value={k} key={k}>{FINISH_PRESETS[k].label}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 3, fontSize: 11 }}>Top rail finish<select value={topRailFinish} onChange={(e) => setTopRailFinish(e.target.value as FinishKey)}>{(Object.keys(FINISH_PRESETS) as FinishKey[]).map((k) => <option value={k} key={k}>{FINISH_PRESETS[k].label}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 3, fontSize: 11 }}>Table base shape<select value={baseShape} onChange={(e) => setBaseShape(e.target.value as BaseShapeKey)}>{(Object.keys(BASE_SHAPES) as BaseShapeKey[]).map((k) => <option value={k} key={k}>{BASE_SHAPES[k].label}</option>)}</select></label>
      </div>
    </section>
  </main>;
}
