import React, { useEffect, useRef, useState } from "react";
import { useLocation } from 'react-router-dom';
import * as THREE from "three";
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getTelegramPhotoUrl, getTelegramUsername } from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import {
  buildRacket as buildDetailedRacket,
  buildTennisBall as buildDetailedBall,
  BALL_DIAMETER_CM,
} from '../../utils/tennisGear.js';

// ========================== Config ==========================
const CAM = { fov: 55, near: 0.1, far: 5000, phiMin: 0.75, phiMax: 1.35, minR: 80, maxR: 240 };
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// Court (scaled from ITF: 23.77m x 10.97m)
const COURT = {
  L: 118,   // total length (z dimension)
  W: 54,    // total width (x dimension)
  LINE: 0.3,
  NET_H: 3.5,
  NET_TAPE: 0.4,
  SERV_BOX_L: 21, // length from net to service line (half court)
  BASE_MARGIN: 8,
  BOUNCE_E: 0.82, // restitution on bounce
  AIR_DRAG: 0.99,
};

const COLORS = Object.freeze({
  cloth: 0x144a2c,    // green court
  line: 0xffffff,
  net: 0x111111,
  tape: 0xf5f5f5,
  post: 0x7d7d7d,
  crowd: 0x0e0f12,
  player: 0x2563eb,
  ai: 0xef4444,
});

const UI = {
  swingChargeMax: 1.0,
  swingChargeRate: 0.9,  // per second
};

// ===================== Helpers (geo/materials) =====================
const mat = (c, r=0.9, m=0.08)=> new THREE.MeshStandardMaterial({ color:c, roughness:r, metalness:m });
const box = (w,h,d,c)=> new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(c));

// Lines helper (white stripes on court)
function lineRect(scene, x, z, w, d){
  const m = new THREE.MeshBasicMaterial({ color: COLORS.line });
  const g = new THREE.PlaneGeometry(w, d);
  const mesh = new THREE.Mesh(g, m); mesh.rotation.x = -Math.PI/2; mesh.position.set(x, 0.01, z);
  mesh.renderOrder = 2; // draw over court
  scene.add(mesh); return mesh;
}

// ================ Build court & net =================
function buildCourt(scene){
  // Court base
  const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT.W + 2*COURT.BASE_MARGIN, COURT.L + 2*COURT.BASE_MARGIN), mat(COLORS.cloth, 0.95, 0.02));
  court.rotation.x = -Math.PI/2; court.receiveShadow = true; scene.add(court);

  // Main rectangle (doubles court)
  const dblW = COURT.W; const dblL = COURT.L;
  // Outer lines
  lineRect(scene, 0, 0, dblW, COURT.LINE);
  lineRect(scene, 0, 0, COURT.LINE, dblL);
  lineRect(scene, 0,  dblL/2, dblW, COURT.LINE);
  lineRect(scene, 0, -dblL/2, dblW, COURT.LINE);
  lineRect(scene,  dblW/2, 0, COURT.LINE, dblL);
  lineRect(scene, -dblW/2, 0, COURT.LINE, dblL);

  // Singles sidelines (optional visual within doubles)
  const sW = COURT.W * 0.82; // ~8.23/10.97
  lineRect(scene,  sW/2, 0, COURT.LINE, dblL);
  lineRect(scene, -sW/2, 0, COURT.LINE, dblL);

  // Baselines
  lineRect(scene, 0,  dblL/2, dblW, COURT.LINE);
  lineRect(scene, 0, -dblL/2, dblW, COURT.LINE);

  // Service line & center
  lineRect(scene, 0,  COURT.SERV_BOX_L, sW, COURT.LINE);
  lineRect(scene, 0, -COURT.SERV_BOX_L, sW, COURT.LINE);
  lineRect(scene, 0,  0, COURT.LINE, sW); // center line

  // Net (simple box for tape + thin box for mesh)
  const netY = COURT.NET_H;
  const net = box(dblW, 0.18, 0.2, COLORS.net); net.position.set(0, netY*0.5, 0); // body
  const tape = box(dblW, COURT.NET_TAPE, 0.22, COLORS.tape); tape.position.set(0, netY + COURT.NET_TAPE/2, 0);
  const postL = box(0.4, netY + 2.0, 0.4, COLORS.post); postL.position.set(-dblW/2 - 0.4, (netY + 2.0)/2, 0);
  const postR = postL.clone(); postR.position.x = dblW/2 + 0.4;
  scene.add(net, tape, postL, postR);

  return { netY };
}

// ================= Physics & game state =================
function makeBall(scene) {
  const mesh = buildDetailedBall();
  // make the ball as large as the racket was previously
  const scale = 7.65 / (BALL_DIAMETER_CM / 2);
  mesh.scale.setScalar(scale);
  mesh.position.set(0, 6, 0);
  scene.add(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(0, 6, 0),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    alive: true,
  };
}

function makeRacket(scene, color) {
  const group = buildDetailedRacket();
  group.rotation.y = Math.PI / 2;
  const box0 = new THREE.Box3().setFromObject(group);
  // shrink the racket head to the former ball size
  const scale = 3 / box0.getSize(new THREE.Vector3()).x;
  group.scale.setScalar(scale);
  const box = new THREE.Box3().setFromObject(group);
  group.position.x -= box.min.x;
  group.position.y -= box.min.y;
  group.position.z -= (box.min.z + box.max.z) / 2;
  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.material = obj.material.clone();
      obj.material.color.set(color);
    }
  });
  scene.add(group);
  return { group };
}

const SCORE_MAP = [0,15,30,40];

function ScorePanel({ hud, pAvatar, pName, aAvatar, aName }){
  const point = i => SCORE_MAP[Math.min(i,3)] ?? 40;
  return (
    <div className="absolute top-2 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <div className="flex items-center gap-4 bg-black/70 text-white rounded px-4 py-2">
        <div className="flex flex-col items-center gap-1">
          <img src={pAvatar} alt="You" className="w-8 h-8 rounded-full" />
          {pName && <span className="text-xs font-semibold">{pName}</span>}
          <div className="flex gap-1">
            {hud.pSets.map((g,i)=>(<div key={i} className="w-6 h-6 bg-black/50 rounded text-xs flex items-center justify-center">{g}</div>))}
          </div>
        </div>
        <div className="text-lg font-bold">{point(hud.pPts)}</div>
        <span className="text-lg">-</span>
        <div className="text-lg font-bold">{point(hud.aiPts)}</div>
        <div className="flex flex-col items-center gap-1">
          <img src={aAvatar} alt="AI" className="w-8 h-8 rounded-full" />
          {aName && <span className="text-xs font-semibold">{aName}</span>}
          <div className="flex gap-1">
            {hud.aiSets.map((g,i)=>(<div key={i} className="w-6 h-6 bg-black/50 rounded text-xs flex items-center justify-center">{g}</div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tennis3D({ pAvatar, pName }){
  const rootRef = useRef(null);
  const rafRef = useRef(0);
  const keys = useRef({});
  const [hud, setHud] = useState({ pPts:0, aiPts:0, pSets:[0,0,0], aiSets:[0,0,0] });

  useEffect(()=>{
    const host = rootRef.current; if(!host) return;
    let scene, camera, renderer, sph;
    let last = performance.now();

    // Game state
    let servingSide = 1; // +1 right, -1 left (from player's perspective)
    let phase = 'serve'; // 'serve' | 'rally'
    let serveFaults = 0;
    let server = 'P';
    let aiServeTimer = 0;

    const player = { x:0, z: COURT.L/2 - 6, speed: 60, aimX:0, aimZ: 0.4, power: 0 };
    const ai     = { x:0, z:-COURT.L/2 + 6, speed: 52, cooldown: 0 };

    function resetBallForServe(ball, who='P'){
      phase = 'serve';
      serveFaults = 0;
      server = who;
      if(who==='AI'){
        ball.pos.set(ai.x, 6, ai.z + 3);
        aiServeTimer = 0.5; // short delay before AI serves
      } else {
        ball.pos.set(player.x, 6, player.z - 3);
      }
      ball.vel.set(0, 0, 0);
      ball.spin.set(0,0,0);
      ball.mesh.position.copy(ball.pos);
    }

    try{
      // Renderer & scene
      renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'high-performance' });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.zIndex = '0';
      host.appendChild(renderer.domElement);

      scene = new THREE.Scene(); scene.background = new THREE.Color(COLORS.crowd);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.95));
      const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(-80, 140, 40); scene.add(sun);

      // Camera orbit
      camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
      // Position camera behind the player so the court runs horizontally across the screen
      sph = new THREE.Spherical(160, (CAM.phiMin + CAM.phiMax) / 2, 0);
      const camTarget = new THREE.Vector3(0, 0, 0);
      const fit = () => {
        let w = host.clientWidth;
        let h = host.clientHeight;
        if (!w || !h) {
          w = window.innerWidth;
          h = window.innerHeight;
        }
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        const fovRad = THREE.MathUtils.degToRad(CAM.fov);
        const vNeeded = (COURT.L + COURT.BASE_MARGIN * 2) /
          (2 * Math.tan(fovRad / 2));
        const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * camera.aspect);
        const hNeeded = (COURT.W + COURT.BASE_MARGIN * 2) /
          (2 * Math.tan(hFov / 2));
        sph.radius = Math.min(
          CAM.maxR,
          Math.max(vNeeded, hNeeded, CAM.minR)
        );

        camera.position.setFromSpherical(sph);
        camera.lookAt(camTarget);
      };
      fit();

      // Build court
      buildCourt(scene);

      // Entities
      const ball = makeBall(scene);
      const racketP = makeRacket(scene, COLORS.player);
      const racketA = makeRacket(scene, COLORS.ai);

      resetBallForServe(ball, 'P');

      // Input
      const onKey = (e)=>{ keys.current[e.code] = e.type === 'keydown'; };
      window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

      // Mouse aim/power
      let charging = false, lastMouse = {x:0,y:0};
      const onMouseDown = (e)=>{ if(phase==='serve' || phase==='rally'){ charging = true; } lastMouse.x=e.clientX; lastMouse.y=e.clientY; };
      const onMouseUp   = ()=>{ if(charging){ charging=false; tryHit(ball, true); } };
      const onMouseMove = (e)=>{
        const dx = e.clientX - lastMouse.x; const dy = e.clientY - lastMouse.y; lastMouse.x=e.clientX; lastMouse.y=e.clientY;
        // Adjust aim when charging
        if(charging){
          player.aimX = clamp(player.aimX + dx * 0.0018, -0.8, 0.8);
          player.aimZ = clamp(player.aimZ - dy * 0.0016, 0.15, 0.85); // 0.15 short, 0.85 long
        }
      };
      renderer.domElement.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mousemove', onMouseMove);

      // Touch controls (drag to move, flick up to hit)
      const touch = { startX: 0, startY: 0, time: 0 };
      const updatePlayerFromTouch = (t)=>{
        const rect = renderer.domElement.getBoundingClientRect();
        const xNorm = (t.clientX - rect.left) / rect.width;
        player.x = THREE.MathUtils.lerp(-COURT.W*0.35, COURT.W*0.35, xNorm);
      };
      const onTouchStart = (e)=>{
        const t = e.touches[0];
        touch.startX = t.clientX; touch.startY = t.clientY; touch.time = performance.now();
        updatePlayerFromTouch(t);
        e.preventDefault();
      };
      const onTouchMove = (e)=>{ updatePlayerFromTouch(e.touches[0]); e.preventDefault(); };
      const onTouchEnd = (e)=>{
        const t = e.changedTouches[0];
        const dy = touch.startY - t.clientY;
        const dx = t.clientX - touch.startX;
        const dist = Math.hypot(dx, dy);
        if(dy > 5 && dist > 5){
          // derive aim and power from swipe gesture similar to free kick game
          player.power = Math.min(1, dist / 100);
          player.aimX = clamp(dx / 100, -0.8, 0.8);
          player.aimZ = clamp(dy / 100, 0.15, 0.85);
          tryHit(ball, true);
        }
        e.preventDefault();
      };
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
      renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
      renderer.domElement.addEventListener('touchend', onTouchEnd);

      // Hit logic
      function tryHit(ball, isPlayer){
        const racket = isPlayer ? racketP : racketA;
        const pos = racket.group.getWorldPosition(new THREE.Vector3());
        const toBall = ball.pos.clone().sub(pos);
        const hitRange = ball.mesh.geometry.boundingSphere.radius * ball.mesh.scale.x + 1.0;
        if(toBall.length() > hitRange) return false;
        // Compose velocity based on aim + power
        const fwd = isPlayer ? -1 : +1; // player hits towards -Z, AI towards +Z
        const lateralAim = isPlayer ? player.aimX : (-Math.sign(ball.pos.x) * 0.6);
        const lateral = THREE.MathUtils.clamp(lateralAim, -0.8, 0.8) * 48;
        const depth   = (isPlayer? player.aimZ : 0.55) * (isPlayer? (60 + player.power*60) : 58);
        const up      = isPlayer? (16 + player.power*22) : 14;
        ball.vel.set(lateral, up, -depth * fwd);
        // add spin for more natural arc
        const spinX = -fwd * (isPlayer? player.power : 0.4) * 50;
        ball.spin.set(spinX, lateral * 0.1, 0);
        phase = 'rally';
        return true;
      }

      // Scoring
      let pPts = 0, aPts = 0;
      function pointTo(who){
        if(who==='P') pPts++; else aPts++;
        setHud(s=>({ ...s, pPts, aiPts: aPts }));
        if(pPts>=4 || aPts>=4){
          const w = pPts>aPts ? 'P' : 'AI';
          setHud(s=>{
            const pSets = [...s.pSets];
            const aiSets = [...s.aiSets];
            if(w==='P') pSets[0] += 1; else aiSets[0] += 1;
            return { ...s, pPts:0, aiPts:0, pSets, aiSets };
          });
          pPts=0; aPts=0; servingSide *= -1; resetBallForServe(ball, w==='P'?'P':'AI');
        } else {
          resetBallForServe(ball, 'P');
        }
      }

      // Detect in/out
      function isInSingles(x,z){
        const halfW = COURT.W*0.82/2, halfL = COURT.L/2; return (x>-halfW && x<halfW && z>-halfL && z<halfL);
      }
      function isInServiceBox(x,z, toNorth){
        const halfW = (COURT.W*0.82)/2; const boxHalfW = halfW; const minZ = toNorth? 0 : -COURT.SERV_BOX_L*2; const maxZ = toNorth? COURT.SERV_BOX_L*2 : 0;
        const left = servingSide>0; const minX = left? 0 : -boxHalfW; const maxX = left? boxHalfW : 0;
        return (z>minZ && z<maxZ && x>minX && x<maxX);
      }

      // Integrate physics
      function step(dt){
        // Player movement
        const k = keys.current; const sp = player.speed * dt;
        if(k['KeyA']||k['ArrowLeft']) player.x -= sp;
        if(k['KeyD']||k['ArrowRight']) player.x += sp;
        if(k['KeyW']||k['ArrowUp']) player.z -= sp*0.6;
        if(k['KeyS']||k['ArrowDown']) player.z += sp*0.6;
        player.x = clamp(player.x, -COURT.W*0.35, COURT.W*0.35);
        player.z = clamp(player.z, COURT.L/2 - 14, COURT.L/2 - 4);

        // Charge power while holding SPACE
        if(k['Space']){ player.power = clamp(player.power + UI.swingChargeRate*dt, 0, UI.swingChargeMax); }
        else { player.power = Math.max(0, player.power - dt*0.6); }

        // Position rackets
        racketP.group.position.set(player.x, 1, player.z);

        // AI simple track
        ai.cooldown = Math.max(0, ai.cooldown - dt);
        const targetX = THREE.MathUtils.clamp(ball.pos.x, -COURT.W*0.3, COURT.W*0.3);
        ai.x += THREE.MathUtils.clamp(targetX - ai.x, -ai.speed*dt, ai.speed*dt);
        racketA.group.position.set(ai.x, 1, ai.z);

        // Ball physics
        if(phase==='serve'){
          if(server==='P'){
            if(keys.current['Space'] && !charging){ charging=true; }
            if(!keys.current['Space'] && charging){ charging=false; player.power = Math.max(0.25, player.power); tryHit(ball, true); }
          } else {
            aiServeTimer -= dt;
            if(aiServeTimer<=0){ tryHit(ball,false); }
          }
        }

        ball.vel.y -= 30 * dt; // gravity
        // Magnus effect from spin for more natural ball movement
        const magnus = ball.spin.clone().cross(ball.vel).multiplyScalar(0.0005);
        ball.vel.addScaledVector(magnus, dt);
        ball.spin.multiplyScalar(0.99);
        ball.vel.multiplyScalar(COURT.AIR_DRAG);
        ball.pos.addScaledVector(ball.vel, dt);

        // Net collision (thin plane at z=0, height netY + tape)
        if(Math.abs(ball.pos.z) < 0.5 && ball.pos.y < (COURT.NET_H + 0.8)){
          ball.vel.z *= -0.4; ball.vel.y *= 0.6; ball.pos.z = (ball.pos.z>0? 0.6 : -0.6);
        }

        // Ground bounce
        if(ball.pos.y < 1.2){
          ball.pos.y = 1.2; if(Math.abs(ball.vel.y) > 2){ ball.vel.y *= -COURT.BOUNCE_E; ball.vel.x *= 0.96; ball.vel.z *= 0.96; }
          else ball.vel.y = 0;
        }

        // Side lines (out)
        const halfW = COURT.W/2; const halfL = COURT.L/2;
        if(Math.abs(ball.pos.x) > halfW+2 || Math.abs(ball.pos.z) > halfL+2){
          pointTo('AI'); return; // simple: out => point to opponent
        }

        // Hit windows (player & AI)
        if(phase!=='serve'){
          // Player attempt auto-hit when close
          const pDist = ball.pos.clone().sub(new THREE.Vector3(player.x,2.2,player.z)).length();
          if(pDist < 3.6 && ball.pos.z > 0 && ball.vel.z > -5 && keys.current['Space']){ tryHit(ball,true); }
          // AI attempt when on its side
          const aDist = ball.pos.clone().sub(new THREE.Vector3(ai.x,2.2,ai.z)).length();
          if(aDist < 3.6 && ball.pos.z < 0 && ball.vel.z < 5 && ai.cooldown<=0){ if(tryHit(ball,false)) ai.cooldown = 0.35; }
        }

        // Point resolution when ball bounces a second time
        if(ball.pos.y<=1.21 && Math.abs(ball.vel.y)<0.01){
          const onNorth = ball.pos.z < 0; // AI side
          if(phase==='serve'){
            const ok = isInServiceBox(ball.pos.x, ball.pos.z, onNorth);
            if(!ok){ serveFaults++; if(serveFaults>=2){ pointTo('AI'); } else { resetBallForServe(ball,'P'); } }
            else { phase='rally'; }
          } else {
            const inSingles = isInSingles(ball.pos.x, ball.pos.z);
            if(!inSingles){ pointTo(onNorth? 'P':'AI'); }
          }
        }

        // Sync meshes
        ball.mesh.position.copy(ball.pos);
      }

      // Loop
      const loop = ()=>{
        const now = performance.now(); const dt = Math.min(0.033, (now-last)/1000); last = now;
        step(dt);
        renderer.render(scene,camera);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();

      // Orbit drag/zoom
      const drag={on:false,x:0,y:0};
      const dom = renderer.domElement;
      const onDown = (e)=>{ drag.on=true; drag.x=e.clientX||e.touches?.[0]?.clientX||0; drag.y=e.clientY||e.touches?.[0]?.clientY||0; };
      const onMove = (e)=>{ if(!drag.on) return; const x=e.clientX||e.touches?.[0]?.clientX||drag.x; const y=e.clientY||e.touches?.[0]?.clientY||drag.y; const dx=x-drag.x, dy=y-drag.y; drag.x=x; drag.y=y; sph.theta -= dx*0.004; sph.phi = clamp(sph.phi + dy*0.003, CAM.phiMin, CAM.phiMax); fit(); };
      const onUp = ()=>{ drag.on=false; };
      const onWheel = (e)=>{ const r = sph.radius || 160; sph.radius = clamp(r + e.deltaY*0.2, CAM.minR, CAM.maxR); fit(); };
      dom.addEventListener('mousedown', onDown); dom.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      dom.addEventListener('wheel', onWheel, {passive:true});

      // Resize
      const onResize = () => { fit(); };
      window.addEventListener('resize', onResize);

      return ()=>{
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
        dom.removeEventListener('mousedown', onDown); dom.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
        dom.removeEventListener('wheel', onWheel);
        renderer.domElement.removeEventListener('touchstart', onTouchStart);
        renderer.domElement.removeEventListener('touchmove', onTouchMove);
        renderer.domElement.removeEventListener('touchend', onTouchEnd);
        try{ host.removeChild(renderer.domElement); }catch{}
      };
    }catch(err){ console.error(err); }
  },[]);

  return (
    <div ref={rootRef} className="relative w-screen h-dvh min-h-screen bg-black text-white overflow-hidden select-none">
      <ScorePanel hud={hud} pAvatar={pAvatar} pName={pName} aAvatar="/assets/avatars/avatar1.svg" aName="AI" />
    </div>
  );
}

export default function TennisBattleRoyal(){
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatarParam = params.get('avatar') || '';
  const usernameParam = params.get('username') || '';
  const [avatar, setAvatar] = useState('');
  const [username, setUsername] = useState('');
  useEffect(()=>{
    try {
      setAvatar(avatarParam || loadAvatar() || getTelegramPhotoUrl());
    } catch {}
    try {
      setUsername(usernameParam || getTelegramUsername());
    } catch {}
  }, [avatarParam, usernameParam]);
  return <Tennis3D pAvatar={avatar || '/assets/avatars/avatar2.svg'} pName={username || 'You'} />;
}

