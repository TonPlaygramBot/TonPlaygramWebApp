import React from "react";
import type { BallPhysicsStateName } from "./gameConfig";

export type UIOverlayProps = {
  nearScore: number;
  farScore: number;
  status: string;
  power: number;
  spin: number;
  debug?: boolean;
  debugState?: {
    ballState: BallPhysicsStateName;
    bounceCount: number;
    hitValidity: string;
    predictedLanding: { x: number; y: number; z: number };
  };
};

export function UIOverlay({ nearScore, farScore, status, power, spin, debug = false, debugState }: UIOverlayProps) {
  return (
    <>
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 220, borderRadius: 18, padding: "10px 12px", background: "rgba(3, 8, 13, 0.62)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", textAlign: "center", boxShadow: "0 12px 36px rgba(0,0,0,0.34)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 900, fontSize: 24 }}>
          <span>{nearScore}</span>
          <span style={{ fontSize: 11, opacity: 0.72, letterSpacing: 1.2 }}>TABLE TENNIS</span>
          <span>{farScore}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: status.startsWith("VAR Replay") ? "#facc15" : "#dff7ff" }}>{status}</div>
      </div>
      <div style={{ position: "absolute", bottom: 34, left: 20, right: 20, borderRadius: 16, padding: 10, background: "rgba(5,10,15,0.44)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff" }}>
        <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.16)", overflow: "hidden" }}><div style={{ width: `${Math.round(power * 100)}%`, height: "100%", background: "linear-gradient(90deg,#67e8f9,#facc15)" }} /></div>
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>Drag to move • release to swing • side drag adds spin {spin ? `(${spin.toFixed(1)})` : ""}</div>
      </div>
      {debug && debugState && (
        <pre style={{ position: "absolute", left: 12, top: 132, maxWidth: 260, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.58)", color: "#a7f3d0", fontSize: 11, textAlign: "left" }}>{`ball=${debugState.ballState}\nbounces=${debugState.bounceCount}\nhit=${debugState.hitValidity}\nlanding=(${debugState.predictedLanding.x.toFixed(2)}, ${debugState.predictedLanding.z.toFixed(2)})`}</pre>
      )}
    </>
  );
}
