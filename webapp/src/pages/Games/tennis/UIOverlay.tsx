import React from "react";
import type { ScoreSnapshot } from "./ScoreManager";

export function UIOverlay({ score }: { score: ScoreSnapshot }) {
  return <span>{score.scoreText}</span>;
}
