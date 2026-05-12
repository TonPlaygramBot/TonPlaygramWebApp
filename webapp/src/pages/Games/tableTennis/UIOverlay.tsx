import React from "react";

export type HudState = { nearScore: number; farScore: number; status: string; power: number; spin: number; shotLabel?: string; replay?: boolean };
export type DebugState = { enabled: boolean; ballState: string; bounceCount: string; hitValidity: string; predictedLanding: string };

type Props = {
  hud: HudState;
  menuOpen: boolean;
  onToggleMenu: () => void;
  graphicsId: "performance" | "balanced" | "ultra";
  onGraphics: (id: "performance" | "balanced" | "ultra") => void;
  humanOptions: Array<{ id: string; label: string; thumbnail?: string }>;
  hdriOptions: Array<{ id: string; label: string; thumbnail?: string }>;
  selectedHumanId: string;
  selectedHdriId: string;
  onHuman: (id: string) => void;
  onHdri: (id: string) => void;
  debug?: DebugState;
};

export default function UIOverlay({ hud, menuOpen, onToggleMenu, graphicsId, onGraphics, humanOptions, hdriOptions, selectedHumanId, selectedHdriId, onHuman, onHdri, debug }: Props) {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <button type="button" onClick={onToggleMenu} style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto", width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,0.32)", background: "rgba(5,10,15,0.78)", color: "#fff", fontSize: 20, fontWeight: 800 }} aria-label={menuOpen ? "Close game settings menu" : "Open game settings menu"}>☰</button>
      {menuOpen && (
        <div style={{ position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto", width: 248, maxHeight: "68vh", overflowY: "auto", borderRadius: 14, border: "1px solid rgba(255,255,255,0.24)", background: "rgba(5,10,15,0.9)", padding: 12, color: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, marginBottom: 8 }}>Graphics</div>
          {(["performance", "balanced", "ultra"] as const).map((option) => <button key={option} type="button" onClick={() => onGraphics(option)} style={{ width: "100%", textAlign: "left", marginTop: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: graphicsId === option ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 10px", fontWeight: 700 }}>{option[0].toUpperCase() + option.slice(1)}</button>)}
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, marginTop: 10 }}>Human Characters</div>
          {humanOptions.map((option) => <button key={option.id} type="button" onClick={() => onHuman(option.id)} style={{ width: "100%", textAlign: "left", marginTop: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: selectedHumanId === option.id ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 10px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{option.thumbnail ? <img src={option.thumbnail} alt={option.label} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} /> : <span>🙂</span>}<span>{option.label}</span></button>)}
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, marginTop: 10 }}>HDRI</div>
          {hdriOptions.map((option) => <button key={option.id} type="button" onClick={() => onHdri(option.id)} style={{ width: "100%", textAlign: "left", marginTop: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: selectedHdriId === option.id ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 10px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{option.thumbnail ? <img src={option.thumbnail} alt={option.label} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} /> : <span>🌆</span>}<span>{option.label}</span></button>)}
        </div>
      )}
      <div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)", color: "white", background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.16)", padding: "9px 13px", borderRadius: 16, fontSize: 13, fontWeight: 850, letterSpacing: 0.2, boxShadow: "0 12px 26px rgba(0,0,0,0.25)", textAlign: "center", minWidth: 178 }}>
        You {hud.nearScore} — {hud.farScore} AI
        <div style={{ fontSize: 11, fontWeight: 650, opacity: 0.84, marginTop: 2 }}>{hud.replay ? "VAR Replay: slow motion review" : hud.status}</div>
        {hud.shotLabel && !hud.replay && <div style={{ fontSize: 10, marginTop: 3, color: "#fef08a" }}>{hud.shotLabel}</div>}
      </div>
      {debug?.enabled && <div style={{ position: "absolute", left: 10, bottom: 12, color: "#dbeafe", background: "rgba(0,0,0,0.56)", borderRadius: 12, padding: 10, fontSize: 11, lineHeight: 1.45 }}>
        <div>State: {debug.ballState}</div><div>Bounces: {debug.bounceCount}</div><div>Hit: {debug.hitValidity}</div><div>Landing: {debug.predictedLanding}</div>
      </div>}
    </div>
  );
}
