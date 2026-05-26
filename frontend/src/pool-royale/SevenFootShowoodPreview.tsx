import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

export type TableKey = 'snooker9ft' | 'showood7ft';
type ClothKey = 'tournamentGreen' | 'royalBlue';
type FinishKey = 'goldRail' | 'chromeRail';
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
const FINISH_PRESETS: Record<FinishKey, { label: string; color: string; metalness: number; roughness: number; railSightColor: string }> = {
  goldRail: { label: 'RailSight + Apron · Gold', color: '#553118', metalness: 0.08, roughness: 0.43, railSightColor: '#d4af37' },
  chromeRail: { label: 'RailSight + Apron · Chrome', color: '#141414', metalness: 0.28, roughness: 0.22, railSightColor: '#cfd6dd' },
};

function proceduralClothTexture(renderer: THREE.WebGLRenderer, tint: string) { const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 192; const ctx = canvas.getContext('2d'); if (!ctx) return null; ctx.fillStyle = tint; ctx.fillRect(0, 0, 192, 192); for (let y = 0; y < 192; y += 4) { const a = 0.03 + ((y / 192) % 1) * 0.02; ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(0, y, 192, 2); } const t = new THREE.CanvasTexture(canvas); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t; }
function cueWoodTexture(renderer: THREE.WebGLRenderer, tint: string) { const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 96; const ctx = canvas.getContext('2d'); if (!ctx) return null; const g = ctx.createLinearGradient(0, 0, 320, 0); g.addColorStop(0, '#2b180d'); g.addColorStop(0.3, tint); g.addColorStop(0.6, '#6f3f21'); g.addColorStop(1, '#2b180d'); ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 96); for (let x = 0; x < 320; x += 10) { ctx.fillStyle = `rgba(255,255,255,${(x % 24 === 0 ? 0.1 : 0.05).toFixed(2)})`; ctx.fillRect(x, 0, 2, 96); } const t = new THREE.CanvasTexture(canvas); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t; }

export default function SevenFootShowoodPreview({ selectedTable, onBack }: { selectedTable: TableKey; onBack: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [cloth, setCloth] = useState<ClothKey>('tournamentGreen');
  const [finish, setFinish] = useState<FinishKey>('goldRail');
  const [shotPower, setShotPower] = useState(0.74);
  const currentMapping = useMemo(() => TABLES[selectedTable].mapping, [selectedTable]);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#020202');
    const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 80); camera.position.set(0, 2.2, 2.2); camera.lookAt(0, 0.2, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.setSize(host.clientWidth, host.clientHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); host.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const key = new THREE.DirectionalLight(0xffffff, 1.4 + shotPower * 0.35); key.position.set(1.8, 3.2, 2); scene.add(key);
    const tableGroup = new THREE.Group(); scene.add(tableGroup);
    const scale = currentMapping.sizeFt === '9ft' ? 1.18 : 0.97;

    const woodTexture = cueWoodTexture(renderer, FINISH_PRESETS[finish].color);
    const woodMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodTexture, metalness: FINISH_PRESETS[finish].metalness, roughness: FINISH_PRESETS[finish].roughness });
    const railMat = new THREE.MeshStandardMaterial({ color: '#5e2f15', map: woodTexture, metalness: 0.1, roughness: 0.35 });
    const railSightMat = new THREE.MeshStandardMaterial({ color: FINISH_PRESETS[finish].railSightColor, metalness: 1, roughness: finish === 'goldRail' ? 0.22 : 0.16 });

    const tableBody = new THREE.Mesh(new THREE.BoxGeometry(currentMapping.playfield.width * scale * 1.08, 0.24, currentMapping.playfield.length * scale * 1.12), woodMat); tableBody.position.y = -0.13; tableGroup.add(tableBody);
    const railFrame = new THREE.Mesh(new THREE.BoxGeometry(currentMapping.playfield.width * scale * 1.16, 0.13, currentMapping.playfield.length * scale * 1.2), railMat); railFrame.position.y = 0.03; tableGroup.add(railFrame);

    const clothTexture = proceduralClothTexture(renderer, CLOTH_PRESETS[cloth].color);
    const clothMesh = new THREE.Mesh(new THREE.PlaneGeometry(currentMapping.playfield.width * scale, currentMapping.playfield.length * scale), new THREE.MeshStandardMaterial({ color: '#ffffff', map: clothTexture, roughness: 0.96, metalness: 0 })); clothMesh.rotation.x = -Math.PI / 2; clothMesh.position.y = 0.045; tableGroup.add(clothMesh);
    const edgeStripMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: clothTexture, roughness: 0.95, metalness: 0 });
    const sidePanelMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: clothTexture, roughness: 0.9, metalness: 0 });
    const edgeInset = 0.02 * scale;
    const edgeWidth = 0.04 * scale;
    const halfW = (currentMapping.playfield.width * scale) / 2;
    const halfL = (currentMapping.playfield.length * scale) / 2;
    const topEdge = new THREE.Mesh(new THREE.PlaneGeometry(currentMapping.playfield.width * scale - edgeInset * 2, edgeWidth), edgeStripMat);
    topEdge.rotation.x = -Math.PI / 2; topEdge.position.set(0, 0.046, -halfL + edgeWidth * 0.5); tableGroup.add(topEdge);
    const bottomEdge = new THREE.Mesh(new THREE.PlaneGeometry(currentMapping.playfield.width * scale - edgeInset * 2, edgeWidth), edgeStripMat);
    bottomEdge.rotation.x = -Math.PI / 2; bottomEdge.position.set(0, 0.046, halfL - edgeWidth * 0.5); tableGroup.add(bottomEdge);
    const leftEdge = new THREE.Mesh(new THREE.PlaneGeometry(edgeWidth, currentMapping.playfield.length * scale - edgeInset * 2), edgeStripMat);
    leftEdge.rotation.x = -Math.PI / 2; leftEdge.position.set(-halfW + edgeWidth * 0.5, 0.046, 0); tableGroup.add(leftEdge);
    const rightEdge = new THREE.Mesh(new THREE.PlaneGeometry(edgeWidth, currentMapping.playfield.length * scale - edgeInset * 2), edgeStripMat);
    rightEdge.rotation.x = -Math.PI / 2; rightEdge.position.set(halfW - edgeWidth * 0.5, 0.046, 0); tableGroup.add(rightEdge);

    const sidePanelGeoLong = new THREE.PlaneGeometry(currentMapping.playfield.width * scale * 1.06, 0.07);
    const sidePanelGeoShort = new THREE.PlaneGeometry(currentMapping.playfield.length * scale * 1.06, 0.07);
    const topPanel = new THREE.Mesh(sidePanelGeoLong, sidePanelMat); topPanel.position.set(0, 0.033, -halfL - 0.04); tableGroup.add(topPanel);
    const bottomPanel = new THREE.Mesh(sidePanelGeoLong, sidePanelMat); bottomPanel.position.set(0, 0.033, halfL + 0.04); bottomPanel.rotation.y = Math.PI; tableGroup.add(bottomPanel);
    const leftPanel = new THREE.Mesh(sidePanelGeoShort, sidePanelMat); leftPanel.position.set(-halfW - 0.04, 0.033, 0); leftPanel.rotation.y = Math.PI / 2; tableGroup.add(leftPanel);
    const rightPanel = new THREE.Mesh(sidePanelGeoShort, sidePanelMat); rightPanel.position.set(halfW + 0.04, 0.033, 0); rightPanel.rotation.y = -Math.PI / 2; tableGroup.add(rightPanel);

    const cushionMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: clothTexture ?? undefined, roughness: 0.84, metalness: 0.01 });
    currentMapping.cushions.forEach((c) => {
      const dx = c.to.x - c.from.x; const dz = c.to.z - c.from.z;
      const len = Math.hypot(dx, dz) * scale;
      const angle = Math.atan2(dz, dx);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.055, 0.065), cushionMat);
      mesh.position.set(((c.from.x + c.to.x) * 0.5) * scale, 0.075, ((c.from.z + c.to.z) * 0.5) * scale);
      mesh.rotation.y = -angle;
      tableGroup.add(mesh);

      const cushionShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(len * 0.98, 0.07),
        new THREE.MeshBasicMaterial({ color: '#8c939a', transparent: true, opacity: 0.32 }),
      );
      cushionShadow.rotation.x = -Math.PI / 2;
      cushionShadow.rotation.z = -angle;
      cushionShadow.position.set(mesh.position.x, 0.047, mesh.position.z);
      tableGroup.add(cushionShadow);
    });

    currentMapping.pockets.forEach((p) => {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(p.radius * scale, p.radius * scale, 0.06, 20), new THREE.MeshStandardMaterial({ color: '#040404' }));
      hole.rotation.x = -Math.PI / 2; hole.position.set(p.center.x * scale, 0.03, p.center.z * scale); tableGroup.add(hole);

      const dir = new THREE.Vector3(-p.center.x, 0, -p.center.z).normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      for (const sign of [-1, 1]) {
        const jaw = new THREE.Mesh(new THREE.CapsuleGeometry(0.012 * scale, 0.048 * scale, 4, 8), railMat);
        jaw.rotation.z = Math.PI / 2;
        jaw.position.set(
          (p.center.x + dir.x * p.jawInset + right.x * sign * p.radius * 0.55) * scale,
          0.074,
          (p.center.z + dir.z * p.jawInset + right.z * sign * p.radius * 0.55) * scale,
        );
        jaw.rotation.y = Math.atan2(dir.z, dir.x);
        tableGroup.add(jaw);
      }

      const chrome = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.007, 0.036 * scale), railSightMat);
      chrome.position.set((p.center.x + dir.x * (p.radius * 1.4)) * scale, 0.102, (p.center.z + dir.z * (p.radius * 1.4)) * scale);
      chrome.rotation.y = Math.atan2(dir.z, dir.x);
      tableGroup.add(chrome);
    });

    const apronStripGeoLong = new THREE.BoxGeometry(currentMapping.playfield.width * scale * 1.05, 0.014, 0.028);
    const apronStripGeoShort = new THREE.BoxGeometry(0.028, 0.014, currentMapping.playfield.length * scale * 1.05);
    const topApron = new THREE.Mesh(apronStripGeoLong, railSightMat); topApron.position.set(0, 0.061, -halfL - 0.052); tableGroup.add(topApron);
    const bottomApron = new THREE.Mesh(apronStripGeoLong, railSightMat); bottomApron.position.set(0, 0.061, halfL + 0.052); tableGroup.add(bottomApron);
    const leftApron = new THREE.Mesh(apronStripGeoShort, railSightMat); leftApron.position.set(-halfW - 0.052, 0.061, 0); tableGroup.add(leftApron);
    const rightApron = new THREE.Mesh(apronStripGeoShort, railSightMat); rightApron.position.set(halfW + 0.052, 0.061, 0); tableGroup.add(rightApron);

    let frame = 0; const animate = () => { frame = requestAnimationFrame(animate); tableGroup.rotation.y += 0.0016; renderer.render(scene, camera); }; animate();
    const onResize = () => { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); clothTexture?.dispose(); woodTexture?.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [cloth, finish, currentMapping, shotPower]);

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
        <label style={{ display: 'grid', gap: 3, fontSize: 11 }}>Cushion/table finish (cue-stick texture on all)<select value={finish} onChange={(e) => setFinish(e.target.value as FinishKey)}>{(Object.keys(FINISH_PRESETS) as FinishKey[]).map((k) => <option value={k} key={k}>{FINISH_PRESETS[k].label}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Shot power (+ bit more)
          <input type="range" min={0.4} max={1} step={0.01} value={shotPower} onChange={(e) => setShotPower(Number(e.target.value))} style={{ width: '100%', height: 24 }} />
          <div style={{ fontSize: 10, color: '#cbd5e1' }}>Power: {(shotPower * 110).toFixed(0)}%</div>
        </label>
      </div>
    </section>
  </main>;
}
