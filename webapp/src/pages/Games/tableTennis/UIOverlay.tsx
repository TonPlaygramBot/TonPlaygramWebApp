import React from "react";
import { BallMotionState } from "./gameConfig";

export type HudState = { nearScore: number; farScore: number; status: string; power: number; spin: number };

export function UIOverlay({ hud, debug, debugOpen }: { hud: HudState; debug?: { state: BallMotionState; bounceCount: number; hitValidity: string; predicted: string }; debugOpen?: boolean }) {
  return (
    <div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)", color: "white", background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.16)", padding: "9px 13px", borderRadius: 16, fontSize: 13, fontWeight: 850, letterSpacing: 0.2, boxShadow: "0 12px 26px rgba(0,0,0,0.25)", textAlign: "center", minWidth: 178 }}>
      You {hud.nearScore} — {hud.farScore} AI
      <div style={{ fontSize: 11, fontWeight: 650, opacity: 0.84, marginTop: 2 }}>{hud.status}</div>
      {debugOpen && debug && (
        <div style={{ marginTop: 6, textAlign: "left", fontSize: 10, fontWeight: 650, opacity: 0.82 }}>
          <div>state: {debug.state}</div>
          <div>bounces: {debug.bounceCount}</div>
          <div>hit: {debug.hitValidity}</div>
          <div>landing: {debug.predicted}</div>
        </div>
      )}
    </div>
  );
}
