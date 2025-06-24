import React from "react";
import HexPrismToken from "./HexPrismToken.jsx";

export default function PlayerToken({ type = "normal", color, topColor, photoUrl, className = "", rolling = false, active = false, timerPct = 1 }) {
  let tokenColor = color;
  if (!tokenColor) {
    if (type === "ladder") tokenColor = "#86efac"; // green
    else if (type === "snake") tokenColor = "#fca5a5"; // red
    else tokenColor = "#fde047"; // yellow
  }
  return (
    <HexPrismToken
      color={tokenColor}
      topColor={topColor}
      photoUrl={photoUrl}
      className={className}
      rolling={rolling}
      active={active}
      timerPct={timerPct}
    />
  );
}
