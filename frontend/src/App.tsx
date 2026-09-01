import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import "./store.css";

type Domino = { id: string; a: number; b: number };
type PlacedDomino = Domino & { left: number; right: number };
type Phase = "player" | "ai" | "won" | "lost" | "blocked";

const PIPS: Record<number, [number, number][]> = {
  0: [], 1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]],
  4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
  5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
  6: [[-1, 1], [-1, 0], [-1, -1], [1, 1], [1, 0], [1, -1]],
};

function makeSet() {
  const set: Domino[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) set.push({ id: `${a}-${b}`, a, b });
  for (let i = set.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [set[i], set[j]] = [set[j], set[i]]; }
  return set;
}

function DominoFace({ domino, hidden = false }: { domino: Domino; hidden?: boolean }) {
  if (hidden) return <span className="domino face-down" aria-label="Hidden domino"><i /></span>;
  return <span className="domino" aria-label={`${domino.a} and ${domino.b}`}>
    {[domino.a, domino.b].map((value, half) => <span className="half" key={half}>{PIPS[value].map(([x, y], i) => <i key={i} style={{ "--x": x, "--y": y } as React.CSSProperties} />)}</span>)}
  </span>;
}

function TableScene({ chain }: { chain: PlacedDomino[] }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const el = host.current, scene = new THREE.Scene();
    scene.background = new THREE.Color(0x092d2a);
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 50); camera.position.set(0, 7.4, 8); camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; el.appendChild(renderer.domElement);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, .35, 48), new THREE.MeshStandardMaterial({ color: 0x0b5047, roughness: .9 })); table.position.y = -.28; scene.add(table);
    const ivory = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: .48 });
    const pip = new THREE.MeshStandardMaterial({ color: 0x171b19, roughness: .7 });
    chain.slice(-9).forEach((d, index, visible) => {
      const x = (index - (visible.length - 1) / 2) * 1.18;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1.05, .18, 2.05), ivory); tile.position.set(x, .03, 0); tile.castShadow = true; scene.add(tile);
      const divider = new THREE.Mesh(new THREE.BoxGeometry(.82, .025, .035), pip); divider.position.set(x, .135, 0); scene.add(divider);
      [d.left, d.right].forEach((n, half) => PIPS[n].forEach(([px, py]) => {
        const dot = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .025, 10), pip);
        dot.position.set(x + px * .2, .145, (half ? .52 : -.52) + py * .2); scene.add(dot);
      }));
    });
    scene.add(new THREE.HemisphereLight(0xd8fff6, 0x10201d, 2.2));
    const key = new THREE.DirectionalLight(0xffe8c2, 4); key.position.set(-3, 8, 5); scene.add(key);
    const resize = () => { renderer.setSize(el.clientWidth, el.clientHeight, false); camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); }; resize();
    const observer = new ResizeObserver(resize); observer.observe(el); let frame = requestAnimationFrame(function draw() { renderer.render(scene, camera); frame = requestAnimationFrame(draw); });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); el.removeChild(renderer.domElement); scene.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); ivory.dispose(); pip.dispose(); };
  }, [chain]);
  return <div className="table-scene" ref={host} aria-label="Royal domino table"><div className="table-shine" /></div>;
}

function beep(tone = 240) {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return; const context = new AudioCtx(), osc = context.createOscillator(), gain = context.createGain();
  osc.frequency.value = tone; gain.gain.setValueAtTime(.06, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .09); osc.connect(gain).connect(context.destination); osc.start(); osc.stop(context.currentTime + .1);
}

export function App() {
  const initial = useMemo(makeSet, []);
  const [hand, setHand] = useState(initial.slice(0, 7));
  const [aiHand, setAiHand] = useState(initial.slice(7, 14));
  const [stock, setStock] = useState(initial.slice(14));
  const [chain, setChain] = useState<PlacedDomino[]>([]);
  const [phase, setPhase] = useState<Phase>("player");
  const [selected, setSelected] = useState<string | null>(null);
  const ends = chain.length ? [chain[0].left, chain[chain.length - 1].right] : null;
  const legal = useCallback((d: Domino) => !ends || ends.includes(d.a) || ends.includes(d.b), [ends]);
  const play = useCallback((d: Domino, side: "left" | "right", actor: "player" | "ai") => {
    let placed: PlacedDomino;
    if (!ends) placed = { ...d, left: d.a, right: d.b };
    else if (side === "left") placed = d.b === ends[0] ? { ...d, left: d.a, right: d.b } : { ...d, left: d.b, right: d.a };
    else placed = d.a === ends[1] ? { ...d, left: d.a, right: d.b } : { ...d, left: d.b, right: d.a };
    setChain(c => side === "left" ? [placed, ...c] : [...c, placed]); beep(actor === "player" ? 310 : 190);
    if (actor === "player") { const next = hand.filter(x => x.id !== d.id); setHand(next); setSelected(null); setPhase(next.length ? "ai" : "won"); }
    else { const next = aiHand.filter(x => x.id !== d.id); setAiHand(next); setPhase(next.length ? "player" : "lost"); }
  }, [aiHand, ends, hand]);

  useEffect(() => {
    if (phase !== "ai") return;
    const timer = window.setTimeout(() => {
      const option = aiHand.find(legal);
      if (option) play(option, !ends || option.a === ends[1] || option.b === ends[1] ? "right" : "left", "ai");
      else if (stock.length) { const drawn = stock[0]; setStock(s => s.slice(1)); setAiHand(h => [...h, drawn]); setPhase("player"); }
      else setPhase(hand.some(legal) ? "player" : "blocked");
    }, 650); return () => clearTimeout(timer);
  }, [aiHand, ends, hand, legal, phase, play, stock]);

  const draw = () => { if (!stock.length || phase !== "player") return; setHand(h => [...h, stock[0]]); setStock(s => s.slice(1)); beep(140); };
  const chosen = hand.find(d => d.id === selected);
  return <main className="royal-app">
    <header><button aria-label="Open menu">☰</button><div><small>DOMINO</small><strong>ROYAL</strong></div><button aria-label="Sound enabled">♪</button></header>
    <section className="opponent"><div className="crest">♛</div><div><b>THE DUKE</b><span>{phase === "ai" ? "Thinking…" : `${aiHand.length} tiles`}</span></div><div className="opponent-hand">{aiHand.slice(0, 5).map(d => <DominoFace key={d.id} domino={d} hidden />)}</div></section>
    <section className="arena">
      <TableScene chain={chain} />
      {!chain.length && <div className="opening"><b>OPENING HAND</b><span>Choose any tile to begin</span></div>}
      {ends && <div className="ends"><span>LEFT · {ends[0]}</span><span>{ends[1]} · RIGHT</span></div>}
    </section>
    <section className="status"><span className={`lamp ${phase}`} />{phase === "player" ? "YOUR TURN" : phase === "ai" ? "THE DUKE'S TURN" : phase === "won" ? "YOU RULE THE TABLE" : phase === "lost" ? "THE DUKE WINS" : "ROUND BLOCKED"}<b>{stock.length} IN BONEYARD</b></section>
    <section className="hand" aria-label="Your hand">{hand.map(d => <button key={d.id} disabled={phase !== "player" || !legal(d)} className={selected === d.id ? "selected" : ""} onClick={() => setSelected(d.id)}><DominoFace domino={d} /></button>)}</section>
    <footer>{chosen ? <div className="play-actions"><button disabled={!!ends && chosen.a !== ends[0] && chosen.b !== ends[0]} onClick={() => play(chosen, "left", "player")}>PLAY LEFT</button><button disabled={!!ends && chosen.a !== ends[1] && chosen.b !== ends[1]} onClick={() => play(chosen, "right", "player")}>PLAY RIGHT</button></div> : <button className="draw" onClick={draw} disabled={phase !== "player" || !stock.length}>DRAW TILE <span>({stock.length})</span></button>}<p>Match either end of the chain</p></footer>
  </main>;
}

export default App;
