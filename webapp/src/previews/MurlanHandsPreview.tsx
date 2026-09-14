import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MurlanHandController } from '../pages/Games/shared/MurlanHandController.ts';

type Transform = { position: number[]; quaternion: number[]; scale: number[] };
type Seat = {
  label: string; chair: Transform; seatRoot: Transform; instance: Transform;
  bones: Record<string, number[]>; forward: number[]; right: number[];
  cards: Transform[]; playFrames: (Transform & { t: number })[];
  playFramesByCard: (Transform & { t: number })[][];
};
declare const MURLAN_PREVIEW_MODEL: string;
declare const MURLAN_PREVIEW_KNOCK: string;
declare const MURLAN_PREVIEW_METRICS: string;
type PreviewMetrics = {
  tableY: number; tableRadius: number; floorY: number;
  cardW: number; cardH: number; cardD: number;
  selectionLift: number; playDuration: number; seats: Seat[]; chairObject: any;
};
const decodedBytes = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const metricsStream = new Blob([decodedBytes(MURLAN_PREVIEW_METRICS)]).stream().pipeThrough(new DecompressionStream('gzip'));
const metrics: PreviewMetrics = JSON.parse(await new Response(metricsStream).text());
const applyTransform = (object: THREE.Object3D, pose: Transform) => {
  object.position.fromArray(pose.position); object.quaternion.fromArray(pose.quaternion);
  object.scale.fromArray(pose.scale);
};

// This is a motion inspection surface, not a second game implementation.
// The avatar and skeleton are shipped production assets. Seat, fan and play
// transforms are sampled directly from MurlanRoyaleArena by the build script.
// All arm solving, release and impact timing use the production controller.
function MurlanHandsPreview() {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<{ seat: (index: number) => void; select: () => void;
    play: () => void; pass: () => void; sound: () => void } | null>(null);
  const [seat, setSeat] = useState(0);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState('Loading seated player…');

  useEffect(() => {
    const stage = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setStatus('This device needs WebGL to show the player.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x102226);
    scene.add(new THREE.HemisphereLight(0xfff6e7, 0x264849, 2.0));
    const key = new THREE.DirectionalLight(0xfff5de, 2.4);
    key.position.set(-4, 9, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0xd7eaff, 1.5);
    rim.position.set(5, 6, -7); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(40, 1, .01, 100);
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(metrics.tableRadius,
      metrics.tableRadius, .12, 72), new THREE.MeshStandardMaterial({ color: 0x14664e, roughness: .96 }));
    cloth.position.y = metrics.tableY - .06; scene.add(cloth);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(metrics.tableRadius, .065, 10, 72),
      new THREE.MeshStandardMaterial({ color: 0xb48b44, roughness: .55, metalness: .32 }));
    rail.rotation.x = Math.PI / 2; rail.position.y = metrics.tableY - .005; scene.add(rail);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x172d2d, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = metrics.floorY - .05; scene.add(ground);

    const faceTextures: THREE.CanvasTexture[] = [];
    const makeCardTexture = (index: number, back = false) => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 224;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = back ? '#163f65' : '#fffaf0'; ctx.fillRect(0, 0, 160, 224);
      ctx.strokeStyle = back ? '#d8bc76' : '#d7cbb2'; ctx.lineWidth = 5;
      ctx.strokeRect(8, 8, 144, 208);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (back) {
        ctx.fillStyle = '#dfc984'; ctx.font = '500 52px Georgia'; ctx.fillText('M', 80, 104);
        ctx.font = '500 13px Georgia'; ctx.fillText('ROYAL', 80, 146);
      } else {
        const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        const suits = ['♠', '♥', '♣', '♦'];
        ctx.fillStyle = index % 2 ? '#ac2435' : '#182328';
        ctx.font = '500 31px Georgia'; ctx.fillText(ranks[index % 13], 27, 30);
        ctx.font = '500 54px Georgia'; ctx.fillText(suits[index % 4], 80, 116);
        ctx.save(); ctx.translate(160, 224); ctx.rotate(Math.PI);
        ctx.font = '500 31px Georgia'; ctx.fillText(ranks[index % 13], 27, 30); ctx.restore();
      }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      faceTextures.push(texture); return texture;
    };
    const backMaterial = new THREE.MeshStandardMaterial({ map: makeCardTexture(0, true), roughness: .85 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xf4e8d0, roughness: .85 });
    const cardGeometry = new THREE.BoxGeometry(metrics.cardW, metrics.cardH, metrics.cardD);
    const cards = Array.from({ length: 13 }, (_, index) => {
      const face = new THREE.MeshStandardMaterial({ map: makeCardTexture(index), roughness: .85 });
      const card = new THREE.Mesh(cardGeometry, [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, face, backMaterial]);
      card.userData.previewIndex = index; card.renderOrder = index + 1; scene.add(card); return card;
    });
    let template: THREE.Group | null = null;
    let chair: THREE.Group | null = null;
    let controller: MurlanHandController | null = null;
    let seatIndex = 0, selectedIndex = -1, running: 'PLAY' | 'PASS' | null = null;
    let handCards = [...cards], playAt = 0, completed = false, disposed = false, raf = 0;
    let soundOff = false, impactCount = 0;
    let audio: AudioContext | null = null, knockBuffer: AudioBuffer | null = null;
    const trackedKnocks: number[] = [];
    const enableAudio = () => {
      try {
        audio ||= new AudioContext();
        void audio.resume();
        if (!knockBuffer) void audio.decodeAudioData(decodedBytes(MURLAN_PREVIEW_KNOCK).buffer)
          .then(buffer => { knockBuffer = buffer; }).catch(() => {});
      } catch { /* Motion remains available when browser audio is unavailable. */ }
    };
    const onImpact = () => {
      impactCount++; trackedKnocks.push(performance.now());
      setStatus(`Right hand · knock ${impactCount} of 2`);
      if (soundOff || !audio || !knockBuffer) return;
      const source = audio.createBufferSource(); source.buffer = knockBuffer;
      source.connect(audio.destination); source.start();
    };

    const updateCamera = () => {
      if (!chair) return;
      const sample = metrics.seats[seatIndex];
      const cardCenter = sample.cards.reduce((sum, card) => sum.add(new THREE.Vector3().fromArray(card.position)),
        new THREE.Vector3()).multiplyScalar(1 / sample.cards.length);
      const head = chair.getObjectByName('Head');
      const headPosition = head?.getWorldPosition(new THREE.Vector3()) ?? cardCenter.clone().add(new THREE.Vector3(0, .8, 0));
      const target = cardCenter.clone().lerp(headPosition, .34);
      const outward = new THREE.Vector3().fromArray(sample.forward);
      const right = new THREE.Vector3().fromArray(sample.right);
      // Fixed per-seat inspection camera: card/body positions stay unchanged.
      const visibleHeight = Math.max(2.4, headPosition.y - Math.min(cardCenter.y, metrics.tableY) + .7);
      const distance = Math.max(4.15, visibleHeight * 1.3 / Math.max(camera.aspect, .65));
      camera.position.copy(target).addScaledVector(outward, -distance)
        .addScaledVector(right, distance * .34).add(new THREE.Vector3(0, distance * .5, 0));
      camera.up.set(0, 1, 0); camera.lookAt(target);
    };

    const restoreCards = () => {
      const sample = metrics.seats[seatIndex];
      cards.forEach((card, index) => { applyTransform(card, sample.cards[index]); card.visible = true; card.userData.animation = null; });
      handCards = [...cards]; selectedIndex = -1; completed = false; running = null;
      setSelected(false); setBusy(false);
    };
    const chooseSeat = (index: number) => {
      if (!template) return;
      controller?.cancel(); if (chair) scene.remove(chair);
      seatIndex = index; const sample = metrics.seats[index];
      chair = new THREE.Group(); applyTransform(chair, sample.chair);
      chair.add(new THREE.ObjectLoader().parse(metrics.chairObject));
      const seatRoot = new THREE.Group(); applyTransform(seatRoot, sample.seatRoot);
      const instance = clone(template); applyTransform(instance, sample.instance);
      instance.traverse(object => {
        const pose = sample.bones[object.name]; if (pose) object.quaternion.fromArray(pose);
        if ((object as THREE.Mesh).isMesh) object.frustumCulled = false;
      });
      seatRoot.add(instance); chair.add(seatRoot); scene.add(chair);
      scene.updateMatrixWorld(true);
      controller = new MurlanHandController({ instance, seatRoot,
        seatConfig: { forward: new THREE.Vector3().fromArray(sample.forward), right: new THREE.Vector3().fromArray(sample.right) }, bones: {} });
      restoreCards(); controller.update(performance.now(), handCards); updateCamera();
      setStatus('Both hands holding the fan');
      (window as any).__MURLAN_MOTION_PREVIEW__ = { scene, camera, cards, get controller() { return controller; },
        metrics, get seat() { return seatIndex; }, knocks: trackedKnocks };
    };
    const selectCard = (index = 6) => {
      if (!controller || running) return;
      if (completed) restoreCards();
      if (selectedIndex === index) index = -1;
      selectedIndex = index;
      cards.forEach((card, cardIndex) => {
        applyTransform(card, metrics.seats[seatIndex].cards[cardIndex]);
        if (index === cardIndex) card.position.y += metrics.selectionLift;
      });
      setSelected(index >= 0); setStatus(index >= 0 ? 'Card selected' : 'Both hands holding the fan');
    };
    const raycaster = new THREE.Raycaster();
    const onPointer = (event: PointerEvent) => {
      if (running) return;
      const box = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1,
        1 - (event.clientY - box.top) / box.height * 2), camera);
      const hit = raycaster.intersectObjects(handCards, false)[0];
      if (hit) selectCard(hit.object.userData.previewIndex);
    };
    renderer.domElement.addEventListener('pointerup', onPointer);
    actions.current = {
      seat: chooseSeat, select: () => selectCard(),
      play: () => {
        if (!controller || selectedIndex < 0 || running) return;
        enableAudio(); playAt = performance.now(); running = 'PLAY';
        const card = cards[selectedIndex];
        card.userData.animation = { duration: metrics.playDuration };
        handCards = cards.filter(item => item !== card);
        controller.start('PLAY', playAt, card, metrics.tableY, undefined, metrics.tableRadius);
        setBusy(true); setStatus('Right hand picks and places');
      },
      pass: () => {
        if (!controller || running) return;
        enableAudio(); if (completed || selectedIndex >= 0) restoreCards();
        impactCount = 0; playAt = performance.now(); running = 'PASS';
        controller.start('PASS', playAt, undefined, metrics.tableY, onImpact, metrics.tableRadius);
        setBusy(true); setStatus('Right hand moves to the table');
      },
      sound: () => { soundOff = !soundOff; setMuted(soundOff); if (!soundOff) enableAudio(); }
    };
    const resize = () => {
      renderer.setSize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight));
      camera.aspect = Math.max(1, stage.clientWidth) / Math.max(1, stage.clientHeight);
      camera.updateProjectionMatrix(); updateCamera();
    };
    const observer = new ResizeObserver(resize); observer.observe(stage); resize();

    const loader = new GLTFLoader();
    // GLTFLoader's normal bitmap path fetches a blob URL. Feed embedded textures
    // through Image instead; neither model nor texture requires fetch or XHR.
    loader.register(parser => ({ name: 'MurlanInlineImages', loadTexture: (index: number) => {
      const asset = parser.json.images[parser.json.textures[index].source];
      return parser.getDependency('bufferView', asset.bufferView).then((buffer: ArrayBuffer) => new Promise<THREE.Texture>((resolve, reject) => {
        const image = new Image(), url = URL.createObjectURL(new Blob([buffer], { type: asset.mimeType }));
        image.onload = () => { const texture = new THREE.Texture(image); texture.flipY = false; texture.needsUpdate = true;
          URL.revokeObjectURL(url); resolve(texture); };
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Avatar image did not load')); };
        image.src = url;
      }));
    } }));
    const compressed = decodedBytes(MURLAN_PREVIEW_MODEL);
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    new Response(stream).arrayBuffer().then(buffer => loader.parseAsync(buffer, '')).then(gltf => {
      if (disposed) return;
      template = gltf.scene; chooseSeat(0); setReady(true);
    }).catch(error => { if (!disposed) setStatus(`Player unavailable: ${String(error.message || error)}`); });

    const animate = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      if (controller && running === 'PLAY') {
        const sample = metrics.seats[seatIndex];
        const elapsed = now - playAt;
        const frames = sample.playFramesByCard?.[selectedIndex] ?? sample.playFrames;
        const progress = THREE.MathUtils.clamp(elapsed / metrics.playDuration, 0, 1) * (frames.length - 1);
        const lo = Math.floor(progress), hi = Math.min(lo + 1, frames.length - 1), t = progress - lo;
        const card = cards[selectedIndex];
        card.position.fromArray(frames[lo].position).lerp(new THREE.Vector3().fromArray(frames[hi].position), t);
        card.quaternion.fromArray(frames[lo].quaternion).slerp(new THREE.Quaternion().fromArray(frames[hi].quaternion), t);
        card.scale.fromArray(frames[lo].scale);
        if (elapsed >= metrics.playDuration) card.userData.animation = null;
      }
      controller?.update(now, handCards);
      if (running && controller && !controller.action && (running === 'PASS' || now - playAt >= metrics.playDuration)) {
        const played = running === 'PLAY'; running = null; completed = played;
        setBusy(false); setSelected(false);
        setStatus(played ? 'Card placed · hands return to the fan' : 'Hands return to the fan');
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); actions.current = null;
      renderer.domElement.removeEventListener('pointerup', onPointer); void audio?.close();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      faceTextures.forEach(texture => texture.dispose()); renderer.dispose(); renderer.domElement.remove();
      delete (window as any).__MURLAN_MOTION_PREVIEW__;
    };
  }, []);

  return <section className="murlan-motion-inspector">
    <div className="viz-controls murlan-motion-heading">
      <span>Murlan Royal · Current seating</span>
      <label className="form-label">Seat
        <select className="form-select" aria-label="Seat" value={seat} disabled={!ready || busy} onChange={event => {
          const next = Number(event.target.value); setSeat(next); actions.current?.seat(next);
        }}>{metrics.seats.map((sample, index) => <option key={index} value={index}>{sample.label}</option>)}</select>
      </label>
    </div>
    <div className="murlan-motion-stage" ref={host} role="img"
      aria-label="Seated Murlan player with both hands holding the original card fan. Select and play a card, or pass to see the right hand knock twice." />
    <div className="viz-controls murlan-motion-actions">
      <button className="btn" type="button" disabled={!ready || busy} aria-pressed={selected}
        onClick={() => actions.current?.select()}>{selected ? 'Clear card' : 'Select card'}</button>
      <button className="btn btn-primary" type="button" disabled={!ready || busy || !selected}
        onClick={() => actions.current?.play()}>Play card</button>
      <button className="btn" type="button" disabled={!ready || busy}
        onClick={() => actions.current?.pass()}>Pass</button>
      <button className="btn btn-ghost" type="button" aria-pressed={muted}
        aria-label={muted ? 'Turn sound on' : 'Mute sound'} onClick={() => actions.current?.sound()}>{muted ? 'Sound off' : 'Sound on'}</button>
    </div>
    <output className="murlan-motion-status" role="status">{status}</output>
  </section>;
}

createRoot(document.getElementById('murlan-royal-hands-preview')!).render(<MurlanHandsPreview />);
