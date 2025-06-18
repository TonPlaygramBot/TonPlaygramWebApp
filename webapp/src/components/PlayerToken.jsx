import React from "react";
import HexPrismToken from "./HexPrismToken.jsx";

export default function PlayerToken({ type = "normal", color, photoUrl }) {
  let tokenColor = color;
  if (!tokenColor) {
    if (type === "ladder") tokenColor = "#86efac"; // green
    else if (type === "snake") tokenColor = "#fca5a5"; // red
    else tokenColor = "#fde047"; // yellow
  }
  return (
    <div className="relative">
      <HexPrismToken color={tokenColor} photoUrl={photoUrl} />
      {photoUrl && (
        <img
          src={photoUrl}
          alt="token avatar"
          className="absolute top-1/2 left-1/2 w-16 h-16 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        />
      )}
    </div>
  );
}
