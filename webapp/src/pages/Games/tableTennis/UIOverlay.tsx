import React from "react";
import type { BallStateName } from "./gameConfig";

export type UIOverlayProps = {
  nearScore: number;
  farScore: number;
  status: string;
  replaying: boolean;
  shotLabel: string;
  menuOpen: boolean;
  debug: boolean;
  debugInfo: {
    state: BallStateName;
    bounceCount: number;
    hitValidity: string;
    predicted: string;
  };
  onToggleMenu: () => void;
  onToggleDebug: () => void;
};

export function UIOverlay(props: UIOverlayProps) {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <button
        type="button"
        onClick={props.onToggleMenu}
        style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto", width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,0.32)", background: "rgba(5,10,15,0.78)", color: "#fff", fontSize: 20, fontWeight: 800 }}
        aria-label={props.menuOpen ? "Close game settings menu" : "Open game settings menu"}
      >
        ☰
      </button>
      <div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)", color: "white", background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.16)", padding: "9px 13px", borderRadius: 16, fontSize: 13, fontWeight: 850, letterSpacing: 0.2, boxShadow: "0 12px 26px rgba(0,0,0,0.25)", textAlign: "center", minWidth: 178 }}>
        You {props.nearScore} — {props.farScore} AI
        <div style={{ fontSize: 11, fontWeight: 650, opacity: 0.84, marginTop: 2 }}>{props.replaying ? "VAR Replay: slow motion review" : props.status}</div>
      </div>
      {props.shotLabel && !props.replaying && (
        <div style={{ position: "absolute", top: 82, left: "50%", transform: "translateX(-50%)", color: "#fff", background: "rgba(20,70,130,0.72)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 800 }}>
          {props.shotLabel}
        </div>
      )}
      {props.menuOpen && (
        <div style={{ position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto", width: 248, borderRadius: 14, border: "1px solid rgba(255,255,255,0.24)", background: "rgba(5,10,15,0.9)", padding: 12, color: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, marginBottom: 8 }}>Table Tennis</div>
          <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>Drag to move. Release after one bounce to hit. Swipe up on serve.</p>
          <button type="button" onClick={props.onToggleDebug} style={{ width: "100%", marginTop: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: props.debug ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 10px", fontWeight: 700 }}>
            Debug overlay {props.debug ? "On" : "Off"}
          </button>
        </div>
      )}
      {props.debug && (
        <div style={{ position: "absolute", left: 12, bottom: 18, color: "#dbeafe", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: 10, fontSize: 11, lineHeight: 1.45 }}>
          <div>state: {props.debugInfo.state}</div>
          <div>bounce count: {props.debugInfo.bounceCount}</div>
          <div>hit: {props.debugInfo.hitValidity}</div>
          <div>landing: {props.debugInfo.predicted}</div>
        </div>
      )}
    </div>
  );
}
