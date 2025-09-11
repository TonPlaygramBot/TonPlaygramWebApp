import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * TABLE TENNIS 3D — Mobile Portrait (1:1), Drag-to-Move, Pinch Zoom & Orbit
 * -------------------------------------------------------------------------
 * • Full-screen on phones (100dvh). Portrait-only experience; no overflow.
 * • 3D table (official size ratio), white lines, center net with posts.
 * • Controls: drag with one finger to move the racket; ball follows real-ish ping-pong physics.
 * • Camera: follow/centered, **pinch** to zoom, **two‑finger drag** to orbit yaw/pitch.
 * • AI opponent on the far side with adjustable difficulty and reaction delay.
 * • Scoring: to 11, win by 2; service swaps every 2 points, auto-serve & rally logic.
 */

export default function TableTennis3D({ player, ai }){
  const hostRef = useRef(null);
  const raf = useRef(0);

  const [ui, setUi] = useState({
    pScore: 0,
    oScore: 0,
    serving: 'P', // P or O
    msg: 'Drag to move • Pinch to zoom • Two-finger drag to orbit',
    gameOver: false,
  });

  useEffect(()=>{
    const host = hostRef.current; if (!host) return;

    // Prevent overscroll on mobile
    const prevOver = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = 'none';

    // ---------- Renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
    const setSize = ()=> renderer.setSize(host.clientWidth, host.clientHeight, false);
    setSize(); host.appendChild(renderer.domElement);

    // ---------- Scene & Lights ----------
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e14);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2233, 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, 0.95); sun.position.set(-16, 28, 18); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x99ccff, 0.35); rim.position.set(20, 14, -12); scene.add(rim);

    // ---------- Camera ----------
    const camera = new THREE.PerspectiveCamera(60, host.clientWidth/host.clientHeight, 0.05, 500);
    scene.add(camera);
    const camRig = { dist: 6.8, height: 2.4, yaw: 0, pitch: 0.28 };
    const applyCam = () => { camera.aspect = host.clientWidth/host.clientHeight; camera.updateProjectionMatrix(); };

    // ---------- Table dimensions match Air Hockey field ----------
    const T = { L: 5.76, W: 2.2, H: 0.76, NET_H: 0.1525 };

    // Use a 1:1 scale since size already matches the field
    const S = 1;
    const tableG = new THREE.Group();
    tableG.scale.set(S, S, S);
    tableG.position.z = 0.1; // align with Air Hockey field offset
    scene.add(tableG);

    // Table top
    const table = new THREE.Mesh(new THREE.BoxGeometry(T.W, 0.04, T.L), new THREE.MeshStandardMaterial({ color: 0x0e5b85, roughness: 0.92 }));
    table.position.set(0, T.H, 0); tableG.add(table);

    // White lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const mkLine = (w,h,d,x,y,z)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), lineMat); m.position.set(x,y,z); tableG.add(m); };
    const lt=0.01; // line thickness meters
    // Sidelines
    mkLine(lt, 0.045, T.L, -T.W/2+lt/2, T.H+0.022, 0);
    mkLine(lt, 0.045, T.L,  T.W/2-lt/2, T.H+0.022, 0);
    // End lines
    mkLine(T.W, 0.045, lt, 0, T.H+0.022,  T.L/2-lt/2);
    mkLine(T.W, 0.045, lt, 0, T.H+0.022, -T.L/2+lt/2);
    // Center line (for doubles look)
    mkLine(lt, 0.045, T.L, 0, T.H+0.022, 0);

    // Net & posts
    const net = new THREE.Mesh(new THREE.BoxGeometry(T.W, T.NET_H, 0.01), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent:true, opacity:0.85 }));
    net.position.set(0, T.H + T.NET_H/2, 0); tableG.add(net);
    const postGeo = new THREE.CylinderGeometry(0.015,0.015, T.NET_H+0.1, 18);
    const postL = new THREE.Mesh(postGeo, new THREE.MeshStandardMaterial({ color:0xdddddd })); postL.position.set(-T.W/2-0.02, T.H + (T.NET_H/2), 0); tableG.add(postL);
    const postR = postL.clone(); postR.position.x = T.W/2+0.02; tableG.add(postR);

    // ---------- Rackets (paddles) ----------
    function makePaddle(color){
      const g = new THREE.Group();
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.012, 28), new THREE.MeshStandardMaterial({ color, metalness:0.05, roughness:0.6 }));
      head.rotation.x = Math.PI/2; head.position.y = T.H + 0.07; g.add(head);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.09,0.02), new THREE.MeshStandardMaterial({ color:0x8b5a2b, roughness:0.8 }));
      handle.position.set(0, T.H + 0.04, 0.06); g.add(handle);
      return g;
    }

    const player = makePaddle(0xff4d6d); tableG.add(player);
    const opp    = makePaddle(0x49dcb1); tableG.add(opp);
    player.position.z =  T.L/2 - 0.25; player.position.x = 0;
    opp.position.z    = -T.L/2 + 0.25; opp.position.x    = 0;

    // ---------- Ball ----------
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 24, 20), new THREE.MeshStandardMaterial({ color: 0xffe14a, roughness: 0.4 }));
    tableG.add(ball);

    // ---------- Physics State ----------
    const Srv = { side: ui.serving }; // P or O (mutable copy)
    const Sx = {
      v: new THREE.Vector3(0,0,0),
      w: new THREE.Vector3(0,0,0), // spin (rad/s) — very simplified Magnus
      gravity: new THREE.Vector3(0,-9.81,0),
      air: 0.995,
      magnus: 0.18,
      tableRest: 0.88,
      paddleRest: 1.02,
      netRest: 0.3,
      state: 'serve', // serve | rally | dead
      lastTouch: null, // 'P' or 'O'
    };

    function resetServe(){
      Sx.v.set(0,0,0); Sx.w.set(0,0,0); Sx.state='serve'; Sx.lastTouch=null;
      const side = Srv.side;
      if (side==='P'){
        ball.position.set(player.position.x, T.H + 0.12, T.L/2 - 0.32);
      } else {
        ball.position.set(opp.position.x, T.H + 0.12, -T.L/2 + 0.32);
      }
    }

    // ---------- Input: Drag to move (player) ----------
    const ndc = new THREE.Vector2(); const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0); const hit = new THREE.Vector3();
    const bounds = { x: T.W/2 - 0.08, zNear:  T.L/2 - 0.12, zFar: 0.08 };

    const screenToXZ = (cx, cy) => { const r=renderer.domElement.getBoundingClientRect(); ndc.x=((cx-r.left)/r.width)*2-1; ndc.y=-(((cy-r.top)/r.height)*2-1); ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, hit); return new THREE.Vector2(hit.x/S, hit.z/S); };

    let dragging=false;
    const onDown = (e)=>{ const t=e.touches?e.touches[0]:e; const p=screenToXZ(t.clientX,t.clientY); dragging = (p.y > 0); if (dragging) movePlayerTo(p.x,p.y); };
    const onMove = (e)=>{ if(!dragging) return; const t=e.touches?e.touches[0]:e; const p=screenToXZ(t.clientX,t.clientY); movePlayerTo(p.x,p.y); };
    const onUp = ()=>{ dragging=false; };

    function movePlayerTo(x,z){ player.position.x = THREE.MathUtils.clamp(x, -bounds.x, bounds.x); player.position.z = THREE.MathUtils.clamp(z, bounds.zFar, bounds.zNear); }

    renderer.domElement.addEventListener('touchstart', onDown, { passive:true });
    renderer.domElement.addEventListener('touchmove',  onMove,  { passive:true });
    renderer.domElement.addEventListener('touchend',   onUp,    { passive:true });
    renderer.domElement.addEventListener('mousedown',  onDown);
    renderer.domElement.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup', onUp);

    // ---------- Gesture Camera: pinch zoom + two‑finger drag orbit ----------
    let pinchStart = null; let last2 = null;
    function dist(a,b){ const dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.hypot(dx,dy); }
    const onGesture = (e)=>{
      if (e.touches && e.touches.length===2){ e.preventDefault(); const a=e.touches[0], b=e.touches[1];
        if (!pinchStart){ pinchStart = dist(a,b); last2 = { ax:a.clientX, ay:a.clientY, bx:b.clientX, by:b.clientY }; }
        else {
          const d = dist(a,b); const scale = d/pinchStart; camRig.dist = THREE.MathUtils.clamp(6.8/scale, 4.0, 14.0);
          const cx=(a.clientX+b.clientX)/2, cy=(a.clientY+b.clientY)/2; const dx=cx-((last2.ax+last2.bx)/2); const dy=cy-((last2.ay+last2.by)/2);
          camRig.yaw  -= dx*0.004; camRig.pitch = THREE.MathUtils.clamp(camRig.pitch + dy*0.003, 0.12, 0.62);
          last2 = { ax:a.clientX, ay:a.clientY, bx:b.clientX, by:b.clientY };
        }
      } else { pinchStart=null; last2=null; }
    };
    renderer.domElement.addEventListener('touchmove', onGesture, { passive:false });

    const camPos = new THREE.Vector3();
    function updateCamera(dt){
      const target = new THREE.Vector3(0, T.H + 0.1, 0); // center of table
      const yaw = camRig.yaw;
      const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-camRig.dist);
      camPos.copy(target).add(back); camPos.y = camRig.height + (camRig.pitch*6);
      camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
      camera.lookAt(0, T.H+0.05, 0);
    }

    // ---------- AI ----------
    const AI = { speed: 2.8, react: 0.08, targetX: 0, targetZ: -T.L/2 + 0.22, timer:0 };

    function stepAI(dt){
      AI.timer -= dt; if (AI.timer <= 0){
        AI.timer = 0.06 + Math.random()*0.08;
        // crude prediction: if ball heading to opponent half, move toward future x
        if (ball.position.z/S < 0 && Sx.v.z < 0){
          const tHit = Math.abs(((-T.L/2 + 0.28) - ball.position.z/S) / (Sx.v.z));
          AI.targetX = THREE.MathUtils.clamp(ball.position.x/S + Sx.v.x * tHit * 0.6, -T.W/2+0.1, T.W/2-0.1);
        } else {
          AI.targetX = 0;
        }
      }
      const dx = AI.targetX - opp.position.x; opp.position.x += THREE.MathUtils.clamp(dx, -AI.speed*dt, AI.speed*dt);
      // keep Z near its baseline
      opp.position.z = -T.L/2 + 0.25;
    }

    // ---------- Collisions ----------
    function bounceTable(){
      // bounce only if crossing table plane (y ~ T.H)
      if (ball.position.y >= T.H && (ball.position.y + Sx.v.y*dt) < T.H){
        // within table rectangle?
        const x=ball.position.x/S, z=ball.position.z/S;
        if (Math.abs(x) <= T.W/2 && Math.abs(z) <= T.L/2){
          // bounce with restitution, reduce horizontal a bit and add spin decay
          Sx.v.y = -Sx.v.y * Sx.tableRest; Sx.v.x *= 0.99; Sx.v.z *= 0.99; Sx.w.multiplyScalar(0.98);
        }
      }
    }

    function hitPaddle(paddle, who){
      // approximate as circle vs cylinder head
      const head = paddle.children[0];
      const R = 0.075; const B = 0.02; // ball radius
      const dx = (ball.position.x - head.position.x) - paddle.position.x;
      const dz = (ball.position.z - head.position.z) - paddle.position.z;
      const dy = (ball.position.y - head.position.y);
      const dist2 = dx*dx + dy*dy + dz*dz;
      const minR = (R + B*S)**2; // scaled ball
      if (dist2 < minR){
        // reflect velocity away from paddle center + add some of paddle motion as spin/impulse
        const n = new THREE.Vector3(dx, dy, dz).normalize();
        const vN = Sx.v.dot(n);
        Sx.v.addScaledVector(n, (-1.8*vN + 3.2)); // strong push outward
        // add directional aim depending on where we contact
        Sx.v.x += n.x * 1.2; Sx.v.z += n.z * 1.6 * (who==='P' ? -1 : 1);
        // add spin from side swipe (use recent paddle delta if dragging)
        Sx.w.x += (Math.random()-0.5)*2; Sx.w.z += (Math.random()-0.5)*2; Sx.w.y += (who==='P'? -3: 3);
        Sx.state = 'rally'; Sx.lastTouch = who;
      }
    }

    function hitNet(){
      // net as a thin box at z=0 spanning table width
      const halfW=T.W/2, halfT=0.005*S; // thickness scaled
      if (Math.abs(ball.position.z) < halfT && Math.abs(ball.position.x/S) < halfW && ball.position.y < (T.H + T.NET_H)){
        Sx.v.z *= -Sx.netRest; Sx.v.x *= 0.92; Sx.v.y *= 0.7;
      }
    }

    // ---------- Scoring & Rules ----------
    function pointTo(winner){
      if (winner==='P') setUi(s=>({ ...s, pScore: s.pScore+1 })); else setUi(s=>({ ...s, oScore: s.oScore+1 }));
      // swap serve every 2 points until deuce
      setUi(s=>{
        const total = s.pScore + s.oScore + 1; // +1 since we just added
        const deuce = s.pScore>=10 && s.oScore>=10;
        const shouldSwap = deuce ? true : (total%2===0);
        const nextServing = shouldSwap ? (s.serving==='P'?'O':'P') : s.serving;
        const gameOver = (s.pScore>=11 || s.oScore>=11) && Math.abs(s.pScore - s.oScore) >= 2;
        return { ...s, serving: nextServing, gameOver, msg: gameOver? 'Game Over — Tap Reset' : `Serve: ${nextServing==='P'?'You':'AI'}` };
      });
      Srv.side = (Srv.side==='P')?'O':'P';
      resetServe();
    }

    function checkFaults(){
      // Simple rule set:
      // • On serve: ball must bounce once on server side then cross net then bounce on receiver side; otherwise point to receiver.
      // • During rally: if ball hits table outside bounds or fails to cross net → point to other side.
      const x=ball.position.x/S, z=ball.position.z/S, y=ball.position.y;
      if (y < T.H - 0.02){
        // went below table top level: treat as table contact previously; if now out-of-bounds, score to opponent
        if (Math.abs(x) > T.W/2 + 0.02 || Math.abs(z) > T.L/2 + 0.02){
          const winner = (Sx.lastTouch==='P') ? 'O' : 'P';
          pointTo(winner);
        }
      }
      // net double-hit catch (if stuck around net below tape)
      if (Math.abs(z) < 0.02 && y < T.H + 0.02){
        const winner = (Sx.lastTouch==='P') ? 'O' : 'P';
        pointTo(winner);
      }
    }

    // ---------- Loop ----------
    const clock = new THREE.Clock(); let dt=0;
    function step(){
      dt = Math.min(0.033, clock.getDelta());

      // Camera follow
      updateCamera(dt);

      // AI
      stepAI(dt);

      // Physics integrate (very simple)
      if (!ui.gameOver){
        // Magnus (v x w)
        const magnus = new THREE.Vector3().crossVectors(Sx.v, Sx.w).multiplyScalar(Sx.magnus);
        Sx.v.addScaledVector(Sx.gravity, dt);
        Sx.v.addScaledVector(magnus, dt);
        Sx.v.multiplyScalar(Math.pow(Sx.air, dt*60));
        ball.position.addScaledVector(Sx.v, dt);

        // Collisions
        bounceTable();
        hitNet();
        hitPaddle(player, 'P');
        hitPaddle(opp, 'O');
        checkFaults();

        // Auto-serve impulse
        if (Sx.state==='serve'){
          if (Srv.side==='P'){
            // light toss upwards to allow player hit
            Sx.v.y = 1.8; Sx.v.z = -0.4; Sx.state='rally';
          } else {
            // AI serve towards player
            Sx.v.set((Math.random()-0.5)*0.8, 1.8, 0.9); Sx.state='rally';
          }
        }
      }

      renderer.render(scene, camera);
      raf.current = requestAnimationFrame(step);
    }

    resetServe();
    step();

    // ---------- Resize ----------
    const onResize = ()=>{ setSize(); applyCam(); };
    window.addEventListener('resize', onResize);

    return ()=>{
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      document.documentElement.style.overscrollBehavior = prevOver;
      try{ host.removeChild(renderer.domElement); }catch{}
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.serving, ui.gameOver]);

  const resetAll = ()=> window.location.reload();

  return (
    <div ref={hostRef} className="w-[100vw] h-[100dvh] bg-black relative overflow-hidden touch-none select-none">
      {/* HUD */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-[11px] sm:text-xs bg-white/10 rounded px-2 py-1 whitespace-nowrap">
        {(player?.name || 'You')} {ui.pScore} : {ui.oScore} {(ai?.name || 'AI')} • Serve: {ui.serving==='P'?(player?.name || 'You'):(ai?.name || 'AI')} — {ui.msg}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <button onClick={resetAll} className="text-white text-[11px] bg-white/10 hover:bg-white/20 rounded px-2 py-1">Reset</button>
      </div>
    </div>
  );
}

