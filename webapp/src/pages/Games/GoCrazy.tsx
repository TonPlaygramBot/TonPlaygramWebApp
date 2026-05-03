"use client";

import React from "react";
import { useLocation } from "react-router-dom";
import SuperTuxKartPlayablePreview from "../../components/GoCrazyGame.jsx";

export default function GoCrazy() {
  const { search } = useLocation();
  const track = new URLSearchParams(search).get("track") || "sunset-gp";
  return <SuperTuxKartPlayablePreview selectedTrack={track} />;
}
