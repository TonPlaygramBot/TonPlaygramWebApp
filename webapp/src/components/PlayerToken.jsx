import React from "react";
import HexPrismToken from "./HexPrismToken.jsx";
import { getAvatarUrl } from "../utils/avatarUtils.js";

export default function PlayerToken({ type = "normal", color, topColor, photoUrl, className = "", rolling = false, active = false, photoOnly = false, spin = true }) {
  let tokenColor = color;
  if (!tokenColor) {
    if (type === "ladder") tokenColor = "#86efac"; // green
    else if (type === "snake") tokenColor = "#fca5a5"; // red
    else tokenColor = "#fde047"; // yellow
  }
  if (photoOnly) {
    return (
      <div className={`token-three relative ${className}`}>
        {photoUrl && (
          <img
            src={getAvatarUrl(photoUrl)}
            alt="token"
            className={`token-photo${rolling ? ' rolling' : ''}${active ? ' active' : ''}`}
            style={{ '--token-border-color': tokenColor }}
          />
        )}
      </div>
    );
  }

  return (
    <HexPrismToken
      color={tokenColor}
      topColor={topColor}
      photoUrl={photoUrl}
      className={className}
      rolling={rolling}
      active={active}
      spin={spin}
    />
  );
}
