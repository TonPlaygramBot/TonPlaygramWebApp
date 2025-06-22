import React from "react";
import HexPrismToken from "./HexPrismToken.jsx";

export default function PlayerToken({ type = "normal", color, topColor, photoUrl, className = "" }) {
  let tokenColor = color;
  if (!tokenColor) {
    if (type === "ladder") tokenColor = "#86efac"; // green
    else if (type === "snake") tokenColor = "#fca5a5"; // red
    else tokenColor = "#fde047"; // yellow
  }
  return (
    <>
      {photoUrl && <span className="token-hexagon" />}
      <HexPrismToken
        color={tokenColor}
        topColor={topColor}
        photoUrl={photoUrl}
        className={className}
      />
    </>
  );
}
