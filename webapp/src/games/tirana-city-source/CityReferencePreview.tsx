import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ReferenceFacades } from './ReferenceFacades';
import { InstitutionLayer } from './InstitutionLayer';
import { REFERENCE_BUILDINGS } from './profiles.mjs';
import { CITY_PLACES } from './registry.mjs';
import { CITY_SOURCE } from './sourceData.mjs';
import { frontage } from './sourceCore.mjs';
import { WORLD } from '../tiranastreets/shared/world.mjs';
const EMPTY_URLS: Record<string, string> = {};
// This original single-building review view only lists footprints in WORLD.
// Multi-building campuses and regional sites use LandmarkExplorer in CityMap.
const CENTRAL_PROFILES=Object.entries(REFERENCE_BUILDINGS).filter(([id])=>WORLD.buildings.some(b=>b.id===id));

/** Review-only view of the actual game models; never a second gameplay route. */
export function CityReferencePreview({ photos = EMPTY_URLS, flags = EMPTY_URLS }: {
  photos?: Record<string, string>; flags?: Record<string, string>;
}) {
  const [selected, setSelected] = useState('175108137');
  const [error, setError] = useState('');
  const mount = useRef<HTMLDivElement>(null);
  const select = useRef<(id: string) => void>(() => {});
  const profile = REFERENCE_BUILDINGS[selected];
  useEffect(() => {
    if (!mount.current) return;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true }); }
    catch { setError('3D preview unavailable on this device. Photo references remain available.'); return; }
    const host = mount.current;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Interactive Tirana building model. Drag to orbit and pinch to zoom.');
    host.appendChild(renderer.domElement);
    const scene = new T.Scene(); scene.background = new T.Color('#c3d5de');
    const camera = new T.PerspectiveCamera(46, 1, .2, 1800);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.maxPolarAngle = Math.PI * .49;
    controls.minDistance = 12; controls.maxDistance = 300;
    const sky = new T.HemisphereLight(0xe4f1ff, 0x938775, 2.4); scene.add(sky);
    const sun = new T.DirectionalLight(0xfff1da, 3); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {left:-110,right:110,top:110,bottom:-110,near:.5,far:400});
    scene.add(sun, sun.target);
    const ground = new T.Mesh(new T.PlaneGeometry(500,500),new T.MeshStandardMaterial({color:0xa4a89d,roughness:1}));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.03; ground.receiveShadow = true; scene.add(ground);
    const facades = new ReferenceFacades(); scene.add(facades.group);
    const institutions = new InstitutionLayer(undefined, [], country => flags[country] || `/assets/tirana-streets/flags/${country.toLowerCase()}.svg`);
    scene.add(institutions.group);
    select.current = id => {
      const building = WORLD.buildings.find(b => b.id === id); if (!building) return;
      const centre = new T.Vector3(
        building.p.reduce((sum,p)=>sum+p[0],0)/building.p.length,
        (REFERENCE_BUILDINGS[id].height ?? building.h) * .36,
        building.p.reduce((sum,p)=>sum+p[1],0)/building.p.length
      );
      const site = CITY_PLACES.sites.find(p=>p.buildingId===id);
      const front = site && frontage(site,WORLD.roads,CITY_SOURCE.entrances);
      const bounds = new T.Box2().setFromPoints(building.p.map(p=>new T.Vector2(...p as [number,number])));
      const span = bounds.getSize(new T.Vector2()).length();
      const nx = front?.nx ?? 0, nz = front?.nz ?? 1;
      camera.position.set(centre.x + nx*span + nz*span*.24, centre.y + span*.36, centre.z + nz*span - nx*span*.24);
      controls.target.copy(centre); controls.update();
      ground.position.set(centre.x,-.03,centre.z);
      sun.position.set(centre.x-55,120,centre.z+50); sun.target.position.copy(centre);
      facades.group.children.forEach(g=>g.visible=g.userData.osmWay===id);
      institutions.group.children.forEach(g=>g.visible=g.userData.buildingId===id);
    };
    select.current(selected);
    const resize = () => {
      const width = Math.max(1,host.clientWidth), height = Math.max(1,host.clientHeight);
      renderer.setSize(width,height); camera.aspect=width/height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, visible = true;
    const visibility = new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;}); visibility.observe(host);
    const draw = (ms: number) => {
      if (visible) { institutions.update(reducedMotion.matches?0:ms/1000); renderer.render(scene,camera); }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect(); controls.dispose();
      institutions.dispose(); facades.dispose(); ground.geometry.dispose(); (ground.material as T.Material).dispose();
      renderer.dispose(); renderer.domElement.remove(); select.current=()=>{};
    };
  }, [flags]);
  useEffect(() => select.current(selected), [selected]);
  return <div className="tirana-reference-preview">
    <div className="tirana-review-toolbar">
      <label htmlFor="tirana-review-building">Tirana · Building details</label>
      <select id="tirana-review-building" value={selected} onChange={event=>setSelected(event.target.value)}>
        {CENTRAL_PROFILES.map(([id,p])=><option key={id} value={id}>{p.name}</option>)}
      </select>
    </div>
    <div className="tirana-review-model" ref={mount} />
    {error && <p role="alert">{error}</p>}
    <div className="tirana-review-status">Photo-informed model · dimensions under review</div>
    {profile.photo && <figure>
      <img src={photos[profile.photo] || `/assets/tirana-streets/references/${profile.photo}`} alt={`${profile.name} — source photograph, ${profile.date}`} />
      <figcaption><a href={profile.source} target="_blank" rel="noreferrer">{profile.credit} · {profile.date}</a></figcaption>
    </figure>}
    {!profile.photo && <p><a href={profile.source} target="_blank" rel="noreferrer">Facade source · {profile.date}</a></p>}
  </div>;
}
