import React, { useEffect } from "react";
import "../../snooker/snooker-table.css";

export default function Snooker() {
  useEffect(() => {
    // --- Utility --------------------------------------------------------------
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    function vec(x = 0, y = 0) { return { x, y }; }
    function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
    function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
    function mul(a, s) { return { x: a.x * s, y: a.y * s }; }
    function dot(a, b) { return a.x * b.x + a.y * b.y; }
    function len(a) { return Math.hypot(a.x, a.y); }
    function norm(a) { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; }

    // --- Table & Physics ------------------------------------------------------
    const canvas = document.getElementById('table');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const rail = 26;
    const pocketR = 24;
    const ballR = 9.5;
    const cushionRestitution = 0.92;
    const friction = 0.992;
    const stopEps = 0.02;

    const tableRect = { x: rail, y: rail, w: W - rail * 2, h: H - rail * 2 };

      const pockets = [
        vec(tableRect.x, tableRect.y),
        vec(tableRect.x + tableRect.w, tableRect.y),
        vec(tableRect.x, tableRect.y + tableRect.h),
        vec(tableRect.x + tableRect.w, tableRect.y + tableRect.h),
        vec(tableRect.x - 2, tableRect.y + tableRect.h / 2),
        vec(tableRect.x + tableRect.w + 2, tableRect.y + tableRect.h / 2)
      ];

    const colors = {
      cue: '#ffffff',
      red: '#b00000',
      yellow: '#facc15',
      green: '#22c55e',
      brown: '#8b5e3c',
      blue: '#3b82f6',
      pink: '#ec4899',
      black: '#111827'
    };

    class Ball {
      constructor(x, y, color, number) {
        this.p = vec(x, y);
        this.v = vec(0, 0);
        this.color = color; this.number = number;
        this.alive = true;
      }
      step(dt) {
        if (!this.alive) return;
        this.p = add(this.p, mul(this.v, dt));
        this.v = mul(this.v, Math.pow(friction, 60 * dt));
        if (len(this.v) < stopEps) this.v = vec(0, 0);
      }
    }

    let balls = [];
    let cueBall;
    let aiming = false; let aimStart = null; let aimCurrent = null; let shotPower = 0;
    let sunkCount = 0, shotCount = 0;

    function placeRack() {
      balls = []; sunkCount = 0; document.getElementById('sunkCount').textContent = sunkCount;
      const centerX = tableRect.x + tableRect.w * 0.5;
      const centerY = tableRect.y + tableRect.h * 0.5;

      cueBall = new Ball(tableRect.x + tableRect.w * 0.25, centerY, colors.cue);
      balls.push(cueBall);

      const startX = tableRect.x + tableRect.w * 0.6;
      const startY = centerY;
      const spacing = ballR * 2 + 1.5;
      let count = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          const x = startX + row * spacing;
          const y = startY + (i - row / 2) * spacing;
          balls.push(new Ball(x, y, colors.red));
          if (++count >= 15) break;
        }
        if (count >= 15) break;
      }

      const addColor = (xp, yp, color) => {
        const x = tableRect.x + tableRect.w * (0.5 + xp);
        const y = tableRect.y + tableRect.h * (0.5 + yp);
        balls.push(new Ball(x, y, color));
      };
      addColor(-0.38, 0.22, colors.yellow);
      addColor(-0.38, -0.22, colors.green);
      addColor(-0.30, 0, colors.brown);
      addColor(0, 0, colors.blue);
      addColor(0.06, 0, colors.pink);
      addColor(0.32, 0, colors.black);
    }

    function allSleeping() {
      return balls.every(b => !b.alive || (b.v.x === 0 && b.v.y === 0));
    }

    function collideBalls(a, b) {
      if (!a.alive || !b.alive) return;
      const d = sub(b.p, a.p);
      const dist = len(d);
      const minDist = ballR * 2;
      if (dist > 0 && dist < minDist) {
        const n = mul(d, 1 / dist);
        const overlap = (minDist - dist) / 2;
        a.p = add(a.p, mul(n, -overlap));
        b.p = add(b.p, mul(n, overlap));
        const rv = sub(b.v, a.v);
        const vn = dot(rv, n);
        if (vn > 0) return;
        const e = 0.98;
        const j = -(1 + e) * vn / 2;
        const impulse = mul(n, j);
        a.v = sub(a.v, impulse);
        b.v = add(b.v, impulse);
      }
    }

    function collideWalls(b) {
      if (!b.alive) return;
      const L = tableRect.x + ballR, R = tableRect.x + tableRect.w - ballR;
      const T = tableRect.y + ballR, B = tableRect.y + tableRect.h - ballR;
      if (b.p.x < L) { b.p.x = L; b.v.x = -b.v.x * cushionRestitution; }
      if (b.p.x > R) { b.p.x = R; b.v.x = -b.v.x * cushionRestitution; }
      if (b.p.y < T) { b.p.y = T; b.v.y = -b.v.y * cushionRestitution; }
      if (b.p.y > B) { b.p.y = B; b.v.y = -b.v.y * cushionRestitution; }
    }

    function checkPockets(b) {
      if (!b.alive) return;
      for (const p of pockets) {
        const d = Math.hypot(b.p.x - p.x, b.p.y - p.y);
        if (d < pocketR - 2) {
          b.alive = false;
          b.v = vec(0, 0);
          if (b === cueBall) {
            setTimeout(() => { if (allSleeping()) respotCue(); }, 200);
          } else {
            sunkCount++; document.getElementById('sunkCount').textContent = sunkCount;
          }
          return;
        }
      }
    }

    function respotCue() {
      const start = vec(tableRect.x + tableRect.w * 0.28, tableRect.y + tableRect.h * 0.5);
      let p = { ...start };
      let safe = false; let attempts = 0;
      while (!safe && attempts < 200) {
        safe = balls.every(b => (b === cueBall || !b.alive) || Math.hypot(b.p.x - p.x, b.p.y - p.y) > ballR * 2.1);
        if (!safe) { p.y += (attempts % 2 ? 1 : -1) * (ballR * 2.2); if (p.y < tableRect.y + ballR) p.y = start.y; if (p.y > tableRect.y + tableRect.h - ballR) p.y = start.y; attempts++; }
      }
      cueBall.alive = true; cueBall.p = p; cueBall.v = vec(0, 0);
    }

    let lastTs = 0;
    function loop(ts) {
      const dt = Math.min(1 / 30, (ts - lastTs) / 1000 || 0); lastTs = ts;
      update(dt); draw(); requestAnimationFrame(loop);
    }

    function update(dt) {
      for (const b of balls) { b.step(dt); collideWalls(b); checkPockets(b); }
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) collideBalls(balls[i], balls[j]);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--rail');
      roundRect(ctx, 6, 6, W - 12, H - 12, 18, true);

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--felt');
      roundRect(ctx, tableRect.x, tableRect.y, tableRect.w, tableRect.h, 14, true);

      for (const p of pockets) {
        const grd = ctx.createRadialGradient(p.x - 4, p.y - 4, 3, p.x, p.y, pocketR);
        grd.addColorStop(0, '#000'); grd.addColorStop(1, '#111');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(p.x, p.y, pocketR, 0, Math.PI * 2); ctx.fill();
      }

      if (aiming && cueBall.alive) {
        ctx.save();
        const a = aimStart, c = aimCurrent;
        const dir = sub(a, c);
        const n = norm(dir);
        ctx.globalAlpha = 0.8; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#e7ecf7';
        ctx.beginPath();
        ctx.moveTo(cueBall.p.x, cueBall.p.y);
        ctx.lineTo(cueBall.p.x + n.x * 200, cueBall.p.y + n.y * 200);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 6; ctx.strokeStyle = '#d2a56b';
        ctx.beginPath();
        ctx.moveTo(cueBall.p.x - n.x * ballR * 1.6, cueBall.p.y - n.y * ballR * 1.6);
        ctx.lineTo(cueBall.p.x - n.x * (ballR * 1.6 + 120 * shotPower), cueBall.p.y - n.y * (ballR * 1.6 + 120 * shotPower));
        ctx.stroke();
        ctx.restore();
      }

      for (const b of balls) { if (!b.alive) continue; drawBall(b); }

      ctx.strokeStyle = '#0b4a2a'; ctx.lineWidth = 2;
      roundRect(ctx, tableRect.x + 1, tableRect.y + 1, tableRect.w - 2, tableRect.h - 2, 13, false, true);
    }

    function drawBall(b) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(b.p.x + 2, b.p.y + 3, ballR * 0.9, ballR * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(b.p.x - 5, b.p.y - 5, 2, b.p.x, b.p.y, ballR);
      g.addColorStop(0, '#fff'); g.addColorStop(0.15, '#fff'); g.addColorStop(0.16, b.color); g.addColorStop(1, shade(b.color, -0.45));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.p.x, b.p.y, ballR, 0, Math.PI * 2); ctx.fill();
      if (b.number) {
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.beginPath(); ctx.arc(b.p.x, b.p.y, ballR * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1d27'; ctx.font = `${ballR * 0.95}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.number, b.p.x, b.p.y);
      }
      ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r, fill = true, stroke = false) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    }

    function shade(hex, pct) {
      const c = hex.replace('#', '');
      const num = parseInt(c, 16);
      let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
      r = Math.round(r * (1 + pct)); g = Math.round(g * (1 + pct)); b = Math.round(b * (1 + pct));
      return `rgb(${clamp(r, 0, 255)},${clamp(g, 0, 255)},${clamp(b, 0, 255)})`;
    }

    function screenToTable(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      return vec(x, y);
    }

    function down(e) {
      const m = screenToTable(e);
      if (!allSleeping()) return;
      if (cueBall.alive && Math.hypot(m.x - cueBall.p.x, m.y - cueBall.p.y) <= ballR + 12) {
        aiming = true; aimStart = m; aimCurrent = m; shotPower = 0; updatePowerBar();
        e.preventDefault();
      }
    }
    function move(e) {
      if (!aiming) return; const m = screenToTable(e); aimCurrent = m;
      const drag = len(sub(aimStart, aimCurrent));
      shotPower = clamp(drag / 160, 0, 1);
      updatePowerBar();
    }
    function up(e) {
      if (!aiming) return; aiming = false; const dir = norm(sub(aimStart, aimCurrent));
        const baseSpeed = 950 * 3 * 1.6 * 1.5 * 0.6;
        const speed = baseSpeed * (0.25 + 0.75 * shotPower) * 2;
      cueBall.v = add(cueBall.v, mul(dir, speed / 60));
      if (shotPower > 0.02) { shotCount++; document.getElementById('shotCount').textContent = shotCount; }
      shotPower = 0; updatePowerBar();
    }
    function updatePowerBar() {
      document.getElementById('powerFill').style.width = (shotPower * 100).toFixed(0) + "%";
    }

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);

    document.getElementById('newRackBtn').onclick = () => { if (allSleeping()) placeRack(); };
    document.getElementById('resetBtn').onclick = () => { if (allSleeping()) respotCue(); };

    placeRack();
    requestAnimationFrame(loop);
  }, []);

  return (
    <div className="snooker-wrap">
      <div className="snooker-hud">
        <div className="snooker-left">
          <span className="snooker-pill">HTML5 Snooker • Practice</span>
          <span className="snooker-pill">Sunk: <span id="sunkCount">0</span></span>
          <span className="snooker-pill">Shots: <span id="shotCount">0</span></span>
          <div className="snooker-powerbar"><div id="powerFill" className="snooker-powerfill" style={{ width: '0%' }}></div></div>
        </div>
        <div className="snooker-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="snooker-note">Drag from the cue ball to aim & set power • Release to shoot</span>
          <span className="snooker-mobile">Tip: pinch to zoom the page if needed</span>
          <button id="newRackBtn" className="snooker-btn">New Rack</button>
          <button id="resetBtn" className="snooker-btn">Re-Spot Cue</button>
        </div>
      </div>
        <canvas id="table" width="360" height="720"></canvas>
    </div>
  );
}

