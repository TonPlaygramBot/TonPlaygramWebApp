import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildRacket, buildTennisBall, BALL_DIAMETER_CM } from "../../utils/tennisGear.js";

/**
 * TENNIS 3D — Mobile Portrait (1:1)
 * -----------------------------------------------------------------------------
 * • Full phone screen (100dvh), portrait-only; zero overflow.
 * • Official court ratio (singles): 23.77m x 8.23m, full markings.
 * • Middle hexagonal net (visual hex mask + thin collision bar).
 * • Controls: 1‑finger drag to move your racket (bottom half). Pinch to zoom, two‑finger drag to orbit.
 * • Basic rally logic vs simple AI on the top side. Scoring 0–15–30–40–Game, service swaps each game.
 */

export default function TennisBattleRoyal(){
  const hostRef = useRef(null);
  const raf = useRef(0);
  const [ui, setUi] = useState({
    player: 0,
    opp: 0,
    serving: 'P', // P or O
    msg: 'Drag to move • Pinch zoom • Two‑finger orbit',
    gameOver: false,
  });

  useEffect(()=>{
    const host = hostRef.current; if (!host) return;

    // Prevent overscroll on mobile
    const prevOver = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = 'none';

    // ---------------- Renderer ----------------
    const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
    const setSize = ()=> renderer.setSize(host.clientWidth, host.clientHeight, false);
    setSize(); host.appendChild(renderer.domElement);

    // ---------------- Scene & Lights ----------------
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e14);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x182030, 0.95));
    const sun  = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(-40, 80, 50); scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8bbcff, 0.35); fill.position.set(40, 40, -30); scene.add(fill);

    // ---------------- Camera (behind bottom baseline) ----------------
    const cam = new THREE.PerspectiveCamera(60, host.clientWidth/host.clientHeight, 0.05, 2000);
    scene.add(cam);
    const camRig = { dist: 26, height: 9, yaw: 0.0, pitch: 0.28 };
    const applyCam = () => { cam.aspect = host.clientWidth/host.clientHeight; cam.updateProjectionMatrix(); };

    // ---------------- Court dims (meters) ----------------
    const C = { L: 23.77, W: 8.23, NET_H: 0.914, SVC_DIST: 6.40, BASE: 11.885 };
    const SCALE = 0.6; // fit portrait nicely (world units = meters * SCALE)
    const S = SCALE;

    const court = new THREE.Group(); court.scale.set(S,S,S); scene.add(court);

    // Court surface
    const surf = new THREE.Mesh(new THREE.BoxGeometry(C.W, 0.1, C.L), new THREE.MeshStandardMaterial({ color: 0x2a8f3a, roughness: 0.95 }));
    surf.position.set(0, -0.05, 0); court.add(surf);

    // Lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const mk = (w,h,d,x,y,z)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), lineMat); m.position.set(x,y,z); court.add(m); };
    const t = 0.05; // 5 cm lines
    // Baselines
    mk(C.W, 0.02, t, 0, 0.01,  C.BASE);
    mk(C.W, 0.02, t, 0, 0.01, -C.BASE);
    // Singles sidelines
    mk(t, 0.02, C.L, -C.W/2, 0.01, 0);
    mk(t, 0.02, C.L,  C.W/2, 0.01, 0);
    // Service lines
    mk(C.W, 0.02, t, 0, 0.01,  C.SVC_DIST);
    mk(C.W, 0.02, t, 0, 0.01, -C.SVC_DIST);
    // Center service line
    mk(t, 0.02, (C.SVC_DIST*2), 0, 0.01, 0);
    // Center marks
    mk(0.2, 0.02, t, 0, 0.01,  C.BASE);
    mk(0.2, 0.02, t, 0, 0.01, -C.BASE);

    // ---------------- Net: hex visual + collision bar ----------------
    const netGroup = new THREE.Group(); court.add(netGroup);
    const hexTex = makeHexTexture(1024, 256, 10);
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: hexTex, transparent:true, roughness:0.6 });
    const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(C.W, C.NET_H), netMat);
    netPlane.position.set(0, C.NET_H/2, 0); netPlane.rotation.y = 0; netGroup.add(netPlane);
    mk(C.W, 0.02, t, 0, C.NET_H+0.02, 0); // tape
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, C.NET_H+0.25, 20);
    const postL = new THREE.Mesh(postGeo, new THREE.MeshStandardMaterial({ color: 0xdddddd })); postL.position.set(-C.W/2-0.06, (C.NET_H+0.25)/2, 0); netGroup.add(postL);
    const postR = postL.clone(); postR.position.x = C.W/2+0.06; netGroup.add(postR);
    const netCol = new THREE.Mesh(new THREE.BoxGeometry(C.W, C.NET_H, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.02 }));
    netCol.position.set(0, C.NET_H/2, 0); netGroup.add(netCol);

    // ---------------- Rackets ----------------
    function makeRacket(){
      const g = buildRacket();
      const box0 = new THREE.Box3().setFromObject(g);
      const desiredWidth = 0.36; // meters
      const scale = (desiredWidth * 100) / box0.getSize(new THREE.Vector3()).x;
      g.scale.setScalar(scale);
      const box = new THREE.Box3().setFromObject(g);
      g.position.set(- (box.min.x + box.max.x)/2, -box.min.y, - (box.min.z + box.max.z)/2);
      return g;
    }

    const player = makeRacket(); court.add(player); player.position.set(0, 0,  C.BASE - 0.8);
    const opp    = makeRacket(); court.add(opp);    opp.position.set(0, 0, -C.BASE + 0.8);

    // ---------------- Ball ----------------
    const ball = buildTennisBall();
    const ballScale = 0.20 / BALL_DIAMETER_CM; // target diameter 0.20m
    ball.scale.setScalar(ballScale);
    court.add(ball);

    // ---------------- Physics ----------------
    const Sx = {
      v: new THREE.Vector3(0,0,0),
      w: new THREE.Vector3(0,0,0),
      gravity: new THREE.Vector3(0,-9.81,0),
      air: 0.996,
      magnus: 0.16,
      restGround: 0.84,
      restRacket: 1.12,
      restNet: 0.22,
      state: 'serve',
      last: null,
      faults: 0,
    };

    function placeForServe(){
      Sx.v.set(0,0,0); Sx.w.set(0,0,0); Sx.state='serve';
      const side = ui.serving;
      if (side==='P'){ ball.position.set(player.position.x, 0.5,  C.BASE - 0.6); }
      else            { ball.position.set(opp.position.x,    0.5, -C.BASE + 0.6); }
    }

    // ---------------- Input: drag to move (bottom half) ----------------
    const ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0); const hit = new THREE.Vector3();
    const bounds = { x: C.W/2 - 0.2, zMin: 0.2, zMax: C.BASE - 0.2 };

    function screenToXZ(cx, cy){ const r=renderer.domElement.getBoundingClientRect(); ndc.x=((cx-r.left)/r.width)*2-1; ndc.y=-(((cy-r.top)/r.height)*2-1); ray.setFromCamera(ndc, cam); ray.ray.intersectPlane(plane, hit); return new THREE.Vector2(hit.x/S, hit.z/S); }

    let dragging=false;
    const onDown = (e)=>{ const t=e.touches?e.touches[0]:e; const p=screenToXZ(t.clientX,t.clientY); if (p.y>0){ dragging=true; movePlayer(p.x,p.y); } };
    const onMove = (e)=>{ if(!dragging) return; const t=e.touches?e.touches[0]:e; const p=screenToXZ(t.clientX,t.clientY); movePlayer(p.x,p.y); };
    const onUp   = ()=>{ dragging=false; };

    function movePlayer(x,z){ player.position.x = THREE.MathUtils.clamp(x, -bounds.x, bounds.x); player.position.z = THREE.MathUtils.clamp(z, bounds.zMin, bounds.zMax); }

    renderer.domElement.addEventListener('touchstart', onDown, { passive:true });
    renderer.domElement.addEventListener('touchmove',  onMove,  { passive:true });
    renderer.domElement.addEventListener('touchend',   onUp,    { passive:true });
    renderer.domElement.addEventListener('mousedown',  onDown);
    renderer.domElement.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup', onUp);

    // ---------------- Pinch zoom + two‑finger orbit ----------------
    let pinchStart=null, last2=null;
    function dist(a,b){ const dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.hypot(dx,dy); }
    const onGesture=(e)=>{
      if (e.touches && e.touches.length===2){ e.preventDefault(); const a=e.touches[0], b=e.touches[1];
        if(!pinchStart){ pinchStart = dist(a,b); last2={ax:a.clientX,ay:a.clientY,bx:b.clientX,by:b.clientY}; }
        else{
          const d=dist(a,b); const scale=d/pinchStart; camRig.dist = THREE.MathUtils.clamp(26/scale, 14, 48);
          const cx=(a.clientX+b.clientX)/2, cy=(a.clientY+b.clientY)/2; const dx=cx-((last2.ax+last2.bx)/2); const dy=cy-((last2.ay+last2.by)/2);
          camRig.yaw  -= dx*0.004; camRig.pitch = THREE.MathUtils.clamp(camRig.pitch + dy*0.003, 0.12, 0.62);
          last2={ax:a.clientX,ay:a.clientY,bx:b.clientX,by:b.clientY};
        }
      } else { pinchStart=null; last2=null; }
    };
    renderer.domElement.addEventListener('touchmove', onGesture, { passive:false });

    const camPos = new THREE.Vector3();
    function updateCamera(dt){
      const target = new THREE.Vector3(0, 0.4, C.BASE*S);
      const yaw = camRig.yaw; const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-camRig.dist);
      camPos.copy(target).add(back); camPos.y = camRig.height + camRig.pitch*14;
      cam.position.lerp(camPos, 1 - Math.pow(0.001, dt));
      cam.lookAt(0, 0.3, 0);
    }

    // ---------------- AI ----------------
    const AI = { speed: 3.6, targetX: 0, timer: 0, baseZ: -C.BASE + 0.7 };
    function stepAI(dt){
      AI.timer -= dt; if (AI.timer <= 0){ AI.timer = 0.06 + Math.random()*0.08;
        if (ball.position.z/S < 0 && Sx.v.z < 0){
          const tHit = Math.abs((AI.baseZ - ball.position.z/S) / (Sx.v.z || 0.001));
          AI.targetX = THREE.MathUtils.clamp((ball.position.x/S) + (Sx.v.x * tHit * 0.7), -C.W/2+0.2, C.W/2-0.2);
        } else { AI.targetX = 0; }
      }
      const dx = AI.targetX - opp.position.x; opp.position.x += THREE.MathUtils.clamp(dx, -AI.speed*dt, AI.speed*dt);
      opp.position.z = AI.baseZ;
    }

    // ---------------- Collisions ----------------
    const BALL_R = 0.10;
    function collideGround(prevY){
      if (prevY > 0 && ball.position.y <= 0){
        const x=ball.position.x/S, z=ball.position.z/S;
        Sx.v.y = -Sx.v.y * Sx.restGround; Sx.v.x *= 0.992; Sx.v.z *= 0.992; Sx.w.multiplyScalar(0.985);
        if (Math.abs(x) > C.W/2 + 0.05 || Math.abs(z) > C.BASE + 0.05){ awardPoint(Sx.last==='P'?'O':'P', 'out'); }
      }
    }

    function collideNet(){
      const h = C.NET_H; const halfT = 0.015;
      if (Math.abs(ball.position.z) < halfT*S && ball.position.y < h*S && Math.abs(ball.position.x/S) < C.W/2){
        Sx.v.z *= -Sx.restNet; Sx.v.x *= 0.9; Sx.v.y *= 0.7;
        if ((Sx.last==='P' && ball.position.z>0) || (Sx.last==='O' && ball.position.z<0)){
          awardPoint(Sx.last==='P'?'O':'P', 'net');
        }
      }
    }

    function hitRacket(r, who){
      const head = r.children[0];
      const box = new THREE.Box3().setFromObject(head);
      const R = box.getSize(new THREE.Vector3()).x/2;
      const dx = (ball.position.x - (r.position.x + head.position.x));
      const dz = (ball.position.z - (r.position.z + head.position.z));
      const dy = (ball.position.y - head.position.y);
      const d2 = dx*dx + dy*dy + dz*dz; const minR = (R + BALL_R*S*0.8)*(R + BALL_R*S*0.8);
      if (d2 < minR){
        const n = new THREE.Vector3(dx, dy, dz).normalize();
        const vN = Sx.v.dot(n);
        Sx.v.addScaledVector(n, (-1.6*vN + 6.0));
        Sx.v.z += (who==='P'? -1.6: 1.6) * (0.4 + Math.random()*0.3);
        Sx.v.x += n.x * 1.2;
        Sx.w.y += (who==='P'? -5: 5);
        Sx.state='rally'; Sx.last=who;
      }
    }

    // ---------------- Scoring ----------------
    function resetGameIfWon(){
      const p=ui.player, o=ui.opp; const winP = (p>=4 && p-o>=2); const winO = (o>=4 && o-p>=2);
      if (winP || winO){ setUi(s=>({ ...s, msg: winP? 'Game You!':'Game AI', player:0, opp:0, serving: s.serving==='P'?'O':'P' })); placeForServe(); }
    }
    function awardPoint(who, reason){
      if (who==='P') setUi(s=>({ ...s, player: s.player+1, msg: `You +1 (${reason})` }));
      else           setUi(s=>({ ...s, opp:    s.opp+1,    msg: `AI +1 (${reason})` }));
      placeForServe();
      setTimeout(resetGameIfWon, 0);
    }

    // ---------------- Loop ----------------
    const clock = new THREE.Clock(); let dt=0;
    function step(){
      dt = Math.min(0.033, clock.getDelta());
      updateCamera(dt);
      stepAI(dt);
      if (Sx.state==='serve'){
        if (ui.serving==='P') { Sx.v.set(0.0, 3.0, -2.4); }
        else                  { Sx.v.set(0.0, 3.0,  2.4); }
        Sx.state='rally'; Sx.last = ui.serving;
      }
      const prevY = ball.position.y;
      const magnus = new THREE.Vector3().crossVectors(Sx.v, Sx.w).multiplyScalar(Sx.magnus);
      Sx.v.addScaledVector(Sx.gravity, dt);
      Sx.v.addScaledVector(magnus, dt);
      Sx.v.multiplyScalar(Math.pow(Sx.air, dt*60));
      ball.position.addScaledVector(Sx.v, dt);
      collideGround(prevY);
      collideNet();
      hitRacket(player, 'P');
      hitRacket(opp,    'O');
      renderer.render(scene, cam);
      raf.current = requestAnimationFrame(step);
    }

    placeForServe();
    step();

    // ---------------- Resize ----------------
    const onResize = ()=>{ setSize(); applyCam(); };
    window.addEventListener('resize', onResize);

    return ()=>{
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      document.documentElement.style.overscrollBehavior = prevOver;
      try { host.removeChild(renderer.domElement); } catch {}
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.serving]);

  return (
    <div ref={hostRef} className="w-[100vw] h-[100dvh] bg-black relative overflow-hidden touch-none select-none">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-[11px] sm:text-xs bg-white/10 rounded px-2 py-1 whitespace-nowrap">
        You {toTennis(ui.player)} : {toTennis(ui.opp)} AI • Serve: {ui.serving==='P'? 'You':'AI'} — {ui.msg}
      </div>
      <button onClick={()=>window.location.reload()} className="absolute left-2 bottom-2 text-white text-[11px] bg-white/10 hover:bg-white/20 rounded px-2 py-1">Reset</button>
    </div>
  );
}

// ---------- Helpers: hex net texture ----------
function makeHexTexture(w=1024,h=256,r=10){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d');
  x.fillStyle='rgba(255,255,255,0)'; x.fillRect(0,0,w,h);
  x.strokeStyle='rgba(255,255,255,0.88)'; x.lineWidth=1.4;
  const dx=r*Math.sqrt(3); const dy=r*1.5;
  function hex(cx,cy){ x.beginPath(); for(let i=0;i<6;i++){ const a=Math.PI/3*i; const px=cx+r*Math.cos(a), py=cy+r*Math.sin(a); if(i===0)x.moveTo(px,py); else x.lineTo(px,py);} x.closePath(); x.stroke(); }
  for(let y=0;y<h+dy;y+=dy){ for(let x0=0;x0<w+dx;x0+=dx){ hex(x0 + ((Math.floor(y/dy)%2)? dx/2:0), y); } }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1,1); return tex;
}

function toTennis(n){ return [0,15,30,40,'Adv','Game'][n] ?? 0; }
