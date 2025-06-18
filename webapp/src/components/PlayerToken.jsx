import React from "react";
import HexPrismToken from "./HexPrismToken.jsx";

export default function PlayerToken({ type = "normal", color, photoUrl, step }) {
  let tokenColor = color;
  if (!tokenColor) {
    if (type === "ladder") tokenColor = "#86efac"; // green
    else if (type === "snake") tokenColor = "#fca5a5"; // red
    else tokenColor = "#fde047"; // yellow
  }
  return (
    <div className="relative">
      <HexPrismToken color={tokenColor} photoUrl={photoUrl} />
      {step != null && (
        <div className="token-step text-white text-xl font-bold">{step}</div>
      )}
    </div>
  );
}
