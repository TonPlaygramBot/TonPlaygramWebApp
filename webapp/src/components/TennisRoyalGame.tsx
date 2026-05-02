"use client";
import React from "react";

export default function MobileThreeTennisPrototype() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07100c', color: '#fff' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, padding: 8, borderRadius: 10, background: 'rgba(0,0,0,0.45)' }}>☰</div>
      <div style={{ position: 'absolute', top: 10, right: 10, padding: 8, borderRadius: 10, background: 'rgba(0,0,0,0.45)' }}>Graphics: High</div>
      <div style={{ position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)', padding: '8px 12px', borderRadius: 12, background: 'rgba(0,0,0,0.5)', fontWeight: 700 }}>
        <span>🇺🇸 You 0</span> — <span>0 AI 🇯🇵</span>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
        <div>
          <h2>Tennis Royal</h2>
          <p>3D tennis engine scaffold is mounted here.</p>
          <p>Lobby supports 1v1 Online and Vs AI with flag avatars.</p>
        </div>
      </div>
    </div>
  );
}
