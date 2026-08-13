import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import "./store.css";

type Layout = "grid" | "list" | "spotlight" | "compact" | "editorial";
type IconName = "back" | "search" | "bag" | "layout" | "grid" | "list" | "star" | "compact" | "editorial" | "camera" | "upload" | "check" | "close" | "home" | "hanger" | "user" | "sparkles";

const icons: Record<IconName, React.ReactNode> = {
  back: <><path d="m15 18-6-6 6-6"/></>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></>,
  layout: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 17h6"/></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/></>,
  star: <path d="m12 3 2.6 5.7 6.2.7-4.6 4.2 1.3 6.1-5.5-3.1-5.5 3.1 1.3-6.1-4.6-4.2 6.2-.7L12 3Z"/>,
  compact: <><rect x="4" y="5" width="7" height="6" rx="1"/><rect x="13" y="5" width="7" height="6" rx="1"/><path d="M4 16h16M4 20h10"/></>,
  editorial: <><rect x="4" y="4" width="16" height="9" rx="1"/><path d="M4 17h10M4 21h7"/></>,
  camera: <><path d="M4 8h4l1.5-2h5L16 8h4v11H4V8Z"/><circle cx="12" cy="13" r="3"/></>,
  upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"/></>, check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  home: <><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/></>, hanger: <path d="M8 7a4 4 0 1 1 5 3.9V13l8 5H3l9-6"/>, user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  sparkles: <><path d="m12 3 1.4 4.1L17 9l-3.6 1.9L12 15l-1.4-4.1L7 9l3.6-1.9L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{icons[name]}</svg>;
}

function AvatarPreview({ scanned }: { scanned: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mount.current) return;
    const host = mount.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 30); camera.position.set(0, .2, 7);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); host.appendChild(renderer.domElement);
    const group = new THREE.Group(); scene.add(group);
    const skin = new THREE.MeshStandardMaterial({ color: scanned ? 0xc98761 : 0x9e6650, roughness: .72 });
    const jacket = new THREE.MeshStandardMaterial({ color: 0x5646f5, roughness: .58, metalness: .05 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x17142a, roughness: .75 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(.72, 32, 24), skin); head.position.y = 1.48; head.scale.set(.86, 1.05, .82); group.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.735, 24, 14, 0, Math.PI * 2, 0, Math.PI * .45), dark); hair.position.y = 1.66; group.add(hair);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.25,.3,.42,20), skin); neck.position.y=.78; group.add(neck);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.9,1.25,8,24), jacket); body.position.y=-.15; body.scale.set(1,.9,.55); group.add(body);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(.38,.075,10,28,Math.PI), dark); collar.rotation.z=Math.PI; collar.position.set(0,.54,.48); group.add(collar);
    scene.add(new THREE.HemisphereLight(0xffffff,0x54436e,2.5)); const light=new THREE.DirectionalLight(0xffffff,3.2); light.position.set(-3,4,4); scene.add(light);
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}; resize();
    let frame=0; const animate=()=>{frame=requestAnimationFrame(animate);group.rotation.y=Math.sin(performance.now()/1800)*.12;renderer.render(scene,camera)}; animate();
    const observer=new ResizeObserver(resize);observer.observe(host);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();host.removeChild(renderer.domElement);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose()}})};
  }, [scanned]);
  return <div className="avatar-canvas" ref={mount}><span className="three-label">LIVE 3D</span></div>;
}

const products = [
  { name: "Cloud Runner", kind: "Sneakers", price: "42 TPG", color: "lavender", mark: "NEW" },
  { name: "Neo Varsity", kind: "Jacket", price: "68 TPG", color: "blue", mark: "POPULAR" },
  { name: "Orbit Shades", kind: "Accessories", price: "21 TPG", color: "orange", mark: "" },
  { name: "Mono Cargo", kind: "Bottoms", price: "37 TPG", color: "lime", mark: "" },
];
const layouts: { id: Layout; name: string; icon: IconName }[] = [
  {id:"grid",name:"Classic grid",icon:"grid"},{id:"list",name:"Product list",icon:"list"},{id:"spotlight",name:"Spotlight",icon:"star"},{id:"compact",name:"Compact",icon:"compact"},{id:"editorial",name:"Editorial",icon:"editorial"}
];

export function App() {
  const [layout,setLayout]=useState<Layout>("grid"); const [layoutsOpen,setLayoutsOpen]=useState(false); const [scanOpen,setScanOpen]=useState(false); const [scanStep,setScanStep]=useState<"intro"|"scanning"|"done">("intro"); const [scanned,setScanned]=useState(false); const [category,setCategory]=useState("Featured");
  const beginScan=()=>{setScanStep("scanning"); window.setTimeout(()=>setScanStep("done"),1800)};
  const useScan=()=>{setScanned(true);setScanOpen(false);setScanStep("intro")};
  return <main className="app-shell">
    <header className="topbar"><button className="round-btn" aria-label="Go back"><Icon name="back"/></button><div className="brand"><span className="brand-dot"/>PLAYGRAM <b>STORE</b></div><div className="header-actions"><button className="round-btn"><Icon name="search"/></button><button className="round-btn bag"><Icon name="bag"/><i>2</i></button></div></header>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow"><Icon name="sparkles" size={13}/> YOUR DIGITAL TWIN</span><h1>Wear it<br/><em>your way.</em></h1><p>Scan once. Preview every look on your own character before you buy.</p><button className={scanned?"scan-button complete":"scan-button"} onClick={()=>setScanOpen(true)}><span><Icon name={scanned?"check":"camera"}/></span><div><b>{scanned?"Face ready":"Create your face"}</b><small>{scanned?"Tap to scan again":"Quick scan · about 10 sec"}</small></div><strong>›</strong></button></div>
      <div className="character-wrap"><div className="glow"/><AvatarPreview scanned={scanned}/><div className="preview-pill"><span>{scanned?"✓":"○"}</span>{scanned?"Your face applied":"Preview character"}</div></div>
    </section>
    <section className="store">
      <div className="store-title"><div><small>CURATED FOR YOU</small><h2>Explore the drop</h2></div><div className="layout-anchor"><button className={layoutsOpen?"layout-trigger active":"layout-trigger"} onClick={()=>setLayoutsOpen(!layoutsOpen)} aria-label="Change store layout"><Icon name="layout"/></button>{layoutsOpen&&<div className="layout-menu"><div className="menu-head"><span>Store layout</span><button onClick={()=>setLayoutsOpen(false)}><Icon name="close" size={17}/></button></div><p>Choose how products appear</p>{layouts.map(item=><button key={item.id} className={layout===item.id?"layout-option selected":"layout-option"} onClick={()=>{setLayout(item.id);setLayoutsOpen(false)}}><span><Icon name={item.icon}/></span><div><b>{item.name}</b><small>{item.id==="grid"?"Balanced tiles":item.id==="list"?"Details at a glance":item.id==="spotlight"?"Large product focus":item.id==="compact"?"See more at once":"Magazine-style story"}</small></div>{layout===item.id&&<Icon name="check" size={17}/>}</button>)}</div>}</div></div>
      <div className="categories">{["Featured","New","Clothing","Shoes","Gear"].map(c=><button className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div>
      <div className={`products layout-${layout}`}>{products.map((p,i)=><article className="product" key={p.name}><div className={`product-art ${p.color}`}><span className="product-number">0{i+1}</span>{p.mark&&<b className="tag">{p.mark}</b>}<div className={`fashion-shape shape-${i}`}><i/><i/></div><button className="try-button" onClick={()=>!scanned&&setScanOpen(true)}>{scanned?"Try on":"Scan to try"}</button></div><div className="product-info"><div><h3>{p.name}</h3><p>{p.kind}</p></div><b>{p.price}</b></div></article>)}</div>
    </section>
    <nav className="bottom-nav"><button className="active"><Icon name="home"/><span>Store</span></button><button><Icon name="hanger"/><span>Closet</span></button><button className="avatar-nav"><span><Icon name="sparkles"/></span><b>Avatar</b></button><button><Icon name="bag"/><span>Bag</span></button><button><Icon name="user"/><span>Profile</span></button></nav>
    {scanOpen&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setScanOpen(false)}><section className="scan-sheet"><button className="modal-close" onClick={()=>setScanOpen(false)}><Icon name="close"/></button>{scanStep==="intro"&&<><div className="scan-visual"><div className="face-outline"><span/><i/><b/></div><div className="corner tl"/><div className="corner tr"/><div className="corner bl"/><div className="corner br"/></div><span className="step-label">ONE QUICK STEP</span><h2>Let’s create your face</h2><p>Look straight at the camera in good light. We’ll place your face on the character so you can preview every item.</p><div className="privacy"><Icon name="check" size={16}/><span>Your scan is private and only used for your avatar.</span></div><button className="primary-action" onClick={beginScan}><Icon name="camera"/> Start face scan</button><button className="upload-action" onClick={beginScan}><Icon name="upload"/> Use a clear photo instead</button></>}{scanStep==="scanning"&&<div className="scanning-state"><div className="scan-ring"><div className="face-outline"><span/><i/><b/></div><i/></div><span className="step-label">HOLD STILL</span><h2>Finding your best angle…</h2><p>Keep your face inside the frame</p></div>}{scanStep==="done"&&<div className="done-state"><div className="done-check"><Icon name="check" size={42}/></div><span className="step-label">LOOKING GOOD</span><h2>Your character is ready</h2><p>Your face has been fitted. You can update it any time.</p><button className="primary-action" onClick={useScan}>See my character</button></div>}</section></div>}
  </main>;
}

export default App;
