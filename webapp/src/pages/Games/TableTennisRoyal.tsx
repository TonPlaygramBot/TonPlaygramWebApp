import React from 'react';

export default function TableTennisRoyal() {
  return (
    <iframe
      title="Table Tennis Royal"
      srcDoc={`<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'/><style>html,body{margin:0;height:100%;background:#091014;color:#fff;font-family:system-ui} .top{position:fixed;top:8px;left:50%;transform:translateX(-50%);padding:10px 14px;border-radius:14px;background:rgba(0,0,0,.6)} .sub{font-size:12px;opacity:.8} .center{display:grid;place-items:center;height:100%;text-align:center;padding:20px}</style></head><body><div class='top'>🇺🇸 Player 1200 — 1200 AI 🇬🇧<div class='sub'>Table Tennis Royal loading…</div></div><div class='center'><div><h2>Table Tennis Royal</h2><p>3D engine module is being initialized.</p></div></div></body></html>`}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0 }}
    />
  );
}
