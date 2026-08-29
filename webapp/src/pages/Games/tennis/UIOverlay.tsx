import React from "react";

export type TennisHud = {
  nearScore: number;
  farScore: number;
  nearLabel?: string;
  farLabel?: string;
  nearGames?: number;
  farGames?: number;
  status: string;
  power: number;
  server?: "near" | "far";
  serveSide?: "deuce" | "ad";
  firstServe?: boolean;
  debug?: string;
};

export function pointLabel(score: number) {
  return ["0", "15", "30", "40", "Ad"][Math.min(score, 4)];
}

export function UIOverlay({ hud, playerName, rivalName, playerAvatar, onMenu }: { hud: TennisHud; playerName: string; rivalName: string; playerAvatar?: string; onMenu: () => void }) {
  return (
    <div style={{ position: "absolute", left: 10, right: 10, top: 10, color: "white", zIndex: 5, pointerEvents: "none" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, background: "rgba(5,12,18,0.72)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 16, padding: "8px 10px", boxShadow: "0 12px 26px rgba(0,0,0,.26)", backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {playerAvatar ? <img src={playerAvatar} alt="" style={{ width: 28, height: 28, borderRadius: 999, objectFit: "cover" }} /> : null}
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 11, opacity: .78 }}>Player</div><div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{playerName}</div></div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 950, fontSize: 18, letterSpacing: 1 }}>{hud.nearLabel ?? pointLabel(hud.nearScore)} : {hud.farLabel ?? pointLabel(hud.farScore)}</div>
          <div style={{ fontSize: 10, opacity: .78 }}>Games {hud.nearGames ?? 0}-{hud.farGames ?? 0} · {hud.server === "far" ? rivalName : playerName} serves {hud.serveSide ?? "deuce"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
          <div style={{ textAlign: "right", minWidth: 0 }}><div style={{ fontSize: 11, opacity: .78 }}>Opponent</div><div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rivalName}</div></div>
          <button type="button" onClick={onMenu} style={{ pointerEvents: "auto", border: "1px solid rgba(255,255,255,.22)", borderRadius: 10, padding: "6px 8px", color: "#fff", background: "rgba(255,255,255,.10)", fontWeight: 800 }}>Menu</button>
        </div>
      </div>
      <div style={{ margin: "7px auto 0", width: "fit-content", maxWidth: "92%", background: "rgba(0,0,0,.46)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800, textAlign: "center" }}>{hud.status}</div>
      {hud.power > 0 ? <div style={{ height: 5, margin: "7px auto 0", maxWidth: 180, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "hidden" }}><div style={{ width: `${Math.round(hud.power * 100)}%`, height: "100%", background: "linear-gradient(90deg,#c8ff39,#ffb02e)" }} /></div> : null}
      {hud.debug ? <pre style={{ margin: "8px auto 0", maxWidth: 320, fontSize: 10, background: "rgba(0,0,0,.55)", borderRadius: 10, padding: 8, whiteSpace: "pre-wrap" }}>{hud.debug}</pre> : null}
    </div>
  );
}
