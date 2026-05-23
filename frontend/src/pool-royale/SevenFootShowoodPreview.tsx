import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type TableKey = 'chinese8Ball9ft' | 'snookerShowood7ft';
type ClothKey = 'tournamentGreen' | 'royalBlue';
type FinishKey = 'cueWoodWalnut' | 'cueWoodBlack';
type PocketId = 'topLeft' | 'topMiddle' | 'topRight' | 'bottomLeft' | 'bottomMiddle' | 'bottomRight';
type CushionId =
  | 'topLeft'
  | 'topMiddle'
  | 'topRight'
  | 'leftTop'
  | 'leftBottom'
  | 'rightTop'
  | 'rightBottom'
  | 'bottomLeft'
  | 'bottomMiddle'
  | 'bottomRight';

type PocketMap = { id: PocketId; center: { x: number; z: number }; radius: number; jawInset: number };
type CushionMap = { id: CushionId; from: { x: number; z: number }; to: { x: number; z: number }; normal: { x: number; z: number }; restitution: number };
type TableMapping = { name: string; sizeFt: '7ft' | '9ft'; playfield: { width: number; length: number; cornerCut: number }; pockets: PocketMap[]; cushions: CushionMap[] };

const TABLES: Record<TableKey, { title: string; subtitle: string; mapping: TableMapping }> = {
  chinese8Ball9ft: {
    title: 'Chinese 8-Ball (9ft)',
    subtitle: 'Renamed from the previous snooker match table with dedicated 9ft mapping.',
    mapping: {
      name: 'Chinese 8-ball 9ft precise mapping',
      sizeFt: '9ft',
      playfield: { width: 2.54, length: 1.27, cornerCut: 0.145 },
      pockets: [
        { id: 'topLeft', center: { x: -1.15, z: -0.58 }, radius: 0.069, jawInset: 0.04 },
        { id: 'topMiddle', center: { x: 0, z: -0.62 }, radius: 0.056, jawInset: 0.03 },
        { id: 'topRight', center: { x: 1.15, z: -0.58 }, radius: 0.069, jawInset: 0.04 },
        { id: 'bottomLeft', center: { x: -1.15, z: 0.58 }, radius: 0.069, jawInset: 0.04 },
        { id: 'bottomMiddle', center: { x: 0, z: 0.62 }, radius: 0.056, jawInset: 0.03 },
        { id: 'bottomRight', center: { x: 1.15, z: 0.58 }, radius: 0.069, jawInset: 0.04 },
      ],
      cushions: [
        { id: 'topLeft', from: { x: -0.95, z: -0.605 }, to: { x: -0.18, z: -0.63 }, normal: { x: 0, z: 1 }, restitution: 0.92 },
        { id: 'topMiddle', from: { x: -0.09, z: -0.635 }, to: { x: 0.09, z: -0.635 }, normal: { x: 0, z: 1 }, restitution: 0.91 },
        { id: 'topRight', from: { x: 0.18, z: -0.63 }, to: { x: 0.95, z: -0.605 }, normal: { x: 0, z: 1 }, restitution: 0.92 },
        { id: 'leftTop', from: { x: -1.21, z: -0.47 }, to: { x: -1.24, z: -0.08 }, normal: { x: 1, z: 0 }, restitution: 0.9 },
        { id: 'leftBottom', from: { x: -1.24, z: 0.08 }, to: { x: -1.21, z: 0.47 }, normal: { x: 1, z: 0 }, restitution: 0.9 },
        { id: 'rightTop', from: { x: 1.21, z: -0.47 }, to: { x: 1.24, z: -0.08 }, normal: { x: -1, z: 0 }, restitution: 0.9 },
        { id: 'rightBottom', from: { x: 1.24, z: 0.08 }, to: { x: 1.21, z: 0.47 }, normal: { x: -1, z: 0 }, restitution: 0.9 },
        { id: 'bottomLeft', from: { x: -0.95, z: 0.605 }, to: { x: -0.18, z: 0.63 }, normal: { x: 0, z: -1 }, restitution: 0.92 },
        { id: 'bottomMiddle', from: { x: -0.09, z: 0.635 }, to: { x: 0.09, z: 0.635 }, normal: { x: 0, z: -1 }, restitution: 0.91 },
        { id: 'bottomRight', from: { x: 0.18, z: 0.63 }, to: { x: 0.95, z: 0.605 }, normal: { x: 0, z: -1 }, restitution: 0.92 },
      ],
    },
  },
  snookerShowood7ft: {
    title: 'Snooker (7ft Showood)',
    subtitle: 'Uses the same table menu, cloth options, and finish options as Showood setup.',
    mapping: {
      name: 'Snooker 7ft Showood precise mapping',
      sizeFt: '7ft',
      playfield: { width: 1.98, length: 0.99, cornerCut: 0.12 },
      pockets: [
        { id: 'topLeft', center: { x: -0.9, z: -0.45 }, radius: 0.063, jawInset: 0.034 },
        { id: 'topMiddle', center: { x: 0, z: -0.48 }, radius: 0.053, jawInset: 0.028 },
        { id: 'topRight', center: { x: 0.9, z: -0.45 }, radius: 0.063, jawInset: 0.034 },
        { id: 'bottomLeft', center: { x: -0.9, z: 0.45 }, radius: 0.063, jawInset: 0.034 },
        { id: 'bottomMiddle', center: { x: 0, z: 0.48 }, radius: 0.053, jawInset: 0.028 },
        { id: 'bottomRight', center: { x: 0.9, z: 0.45 }, radius: 0.063, jawInset: 0.034 },
      ],
      cushions: [
        { id: 'topLeft', from: { x: -0.72, z: -0.47 }, to: { x: -0.15, z: -0.49 }, normal: { x: 0, z: 1 }, restitution: 0.92 },
        { id: 'topMiddle', from: { x: -0.08, z: -0.495 }, to: { x: 0.08, z: -0.495 }, normal: { x: 0, z: 1 }, restitution: 0.91 },
        { id: 'topRight', from: { x: 0.15, z: -0.49 }, to: { x: 0.72, z: -0.47 }, normal: { x: 0, z: 1 }, restitution: 0.92 },
        { id: 'leftTop', from: { x: -0.95, z: -0.36 }, to: { x: -0.975, z: -0.06 }, normal: { x: 1, z: 0 }, restitution: 0.9 },
        { id: 'leftBottom', from: { x: -0.975, z: 0.06 }, to: { x: -0.95, z: 0.36 }, normal: { x: 1, z: 0 }, restitution: 0.9 },
        { id: 'rightTop', from: { x: 0.95, z: -0.36 }, to: { x: 0.975, z: -0.06 }, normal: { x: -1, z: 0 }, restitution: 0.9 },
        { id: 'rightBottom', from: { x: 0.975, z: 0.06 }, to: { x: 0.95, z: 0.36 }, normal: { x: -1, z: 0 }, restitution: 0.9 },
        { id: 'bottomLeft', from: { x: -0.72, z: 0.47 }, to: { x: -0.15, z: 0.49 }, normal: { x: 0, z: -1 }, restitution: 0.92 },
        { id: 'bottomMiddle', from: { x: -0.08, z: 0.495 }, to: { x: 0.08, z: 0.495 }, normal: { x: 0, z: -1 }, restitution: 0.91 },
        { id: 'bottomRight', from: { x: 0.15, z: 0.49 }, to: { x: 0.72, z: 0.47 }, normal: { x: 0, z: -1 }, restitution: 0.92 },
      ],
    },
  },
};

const CLOTH_PRESETS: Record<ClothKey, { label: string; color: string }> = {
  tournamentGreen: { label: 'Procedural Cloth · Tournament Green', color: '#0f6f34' },
  royalBlue: { label: 'Procedural Cloth · Royal Blue', color: '#0f4cb3' },
};
const FINISH_PRESETS: Record<FinishKey, { label: string; color: string; metalness: number; roughness: number }> = {
  cueWoodWalnut: { label: 'Cue Finish · Walnut', color: '#553118', metalness: 0.08, roughness: 0.43 },
  cueWoodBlack: { label: 'Cue Finish · Piano Black', color: '#141414', metalness: 0.28, roughness: 0.22 },
};

function proceduralClothTexture(renderer: THREE.WebGLRenderer, tint: string) { const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d'); if (!ctx) return null; ctx.fillStyle = tint; ctx.fillRect(0,0,256,256); for (let y=0;y<256;y+=4){const a=0.03+((y/256)%1)*0.02; ctx.fillStyle=`rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(0,y,256,2);} const texture=new THREE.CanvasTexture(canvas); texture.wrapS=THREE.RepeatWrapping; texture.wrapT=THREE.RepeatWrapping; texture.repeat.set(4,2); texture.anisotropy=renderer.capabilities.getMaxAnisotropy(); return texture; }

export default function SevenFootShowoodPreview() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableKey>('chinese8Ball9ft');
  const [cloth, setCloth] = useState<ClothKey>('tournamentGreen');
  const [finish, setFinish] = useState<FinishKey>('cueWoodWalnut');
  const currentMapping = useMemo(() => TABLES[selectedTable].mapping, [selectedTable]);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#020202');
    const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 80); camera.position.set(0, 2.2, 2.2); camera.lookAt(0,0.2,0);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(host.clientWidth, host.clientHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); host.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const key = new THREE.DirectionalLight(0xffffff,1.5); key.position.set(1.8,3.2,2); scene.add(key);
    const tableGroup = new THREE.Group(); scene.add(tableGroup);

    const scale = currentMapping.sizeFt === '9ft' ? 1.22 : 1;
    const tableBody = new THREE.Mesh(new THREE.BoxGeometry(currentMapping.playfield.width * scale * 1.08, 0.28, currentMapping.playfield.length * scale * 1.12), new THREE.MeshStandardMaterial({ color: FINISH_PRESETS[finish].color, metalness: FINISH_PRESETS[finish].metalness, roughness: FINISH_PRESETS[finish].roughness }));
    tableBody.position.y = -0.12; tableGroup.add(tableBody);

    const clothTexture = proceduralClothTexture(renderer, CLOTH_PRESETS[cloth].color);
    const clothMesh = new THREE.Mesh(new THREE.PlaneGeometry(currentMapping.playfield.width * scale, currentMapping.playfield.length * scale), new THREE.MeshStandardMaterial({ color:'#ffffff', map: clothTexture, roughness:0.96, metalness:0 }));
    clothMesh.rotation.x = -Math.PI / 2; clothMesh.position.y = 0.03; tableGroup.add(clothMesh);

    currentMapping.pockets.forEach((p)=>{ const hole = new THREE.Mesh(new THREE.CylinderGeometry(p.radius * scale, p.radius * scale, 0.04, 20), new THREE.MeshStandardMaterial({color:'#040404'})); hole.rotation.x = -Math.PI/2; hole.position.set(p.center.x * scale, 0.025, p.center.z * scale); tableGroup.add(hole); });

    let frame = 0; const animate = ()=>{ frame = requestAnimationFrame(animate); tableGroup.rotation.y += 0.002; renderer.render(scene,camera);}; animate();
    const onResize = ()=>{camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight);};
    window.addEventListener('resize', onResize);
    return ()=>{window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); clothTexture?.dispose(); renderer.dispose(); renderer.domElement.remove();};
  }, [cloth, finish, currentMapping]);

  return <main style={{ minHeight:'100vh', background:'#020202', color:'white', fontFamily:'system-ui,sans-serif' }}><div ref={hostRef} style={{ position:'fixed', inset:0 }} />
    <section style={{ position:'fixed', top:8, left:8, right:8, background:'rgba(0,0,0,0.66)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:14, padding:10 }}>
      <div style={{ fontWeight:900, fontSize:13 }}>Pool Royal Lobby · Table Select</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8, marginTop:8 }}>{(Object.keys(TABLES) as TableKey[]).map((key)=><button key={key} onClick={()=>setSelectedTable(key)} style={{ textAlign:'left', borderRadius:12, border:selectedTable===key ? '1px solid #93c5fd' : '1px solid rgba(255,255,255,0.2)', background:selectedTable===key ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)', color:'white', padding:8 }}><div style={{ fontWeight:800, fontSize:12 }}>{TABLES[key].title}</div><div style={{ fontSize:10, color:'#cbd5e1', marginTop:2 }}>{TABLES[key].subtitle}</div></button>)}</div>
    </section>
    <section style={{ position:'fixed', left:8, right:8, bottom:8, background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:14, padding:10 }}>
      <div style={{ fontWeight:900, fontSize:12 }}>Table Setup Menu ({currentMapping.sizeFt})</div>
      <div style={{ marginTop:8, display:'grid', gap:8 }}>
        <label style={{ display:'grid', gap:3, fontSize:11 }}>Cloth (same for both tables)<select value={cloth} onChange={(e)=>setCloth(e.target.value as ClothKey)}>{(Object.keys(CLOTH_PRESETS) as ClothKey[]).map((k)=><option value={k} key={k}>{CLOTH_PRESETS[k].label}</option>)}</select></label>
        <label style={{ display:'grid', gap:3, fontSize:11 }}>Table finish (same for both tables)<select value={finish} onChange={(e)=>setFinish(e.target.value as FinishKey)}>{(Object.keys(FINISH_PRESETS) as FinishKey[]).map((k)=><option value={k} key={k}>{FINISH_PRESETS[k].label}</option>)}</select></label>
        <div style={{ fontSize:10, color:'#cbd5e1' }}>Mapping loaded: {currentMapping.name} · pockets {currentMapping.pockets.length} · cushion segments {currentMapping.cushions.length}</div>
        <div style={{ fontSize:10, color:'#cbd5e1' }}>Resource mode: procedural cloth + local geometry only (no external texture links), reducing slow network loads.</div>
      </div>
    </section>
  </main>;
}
