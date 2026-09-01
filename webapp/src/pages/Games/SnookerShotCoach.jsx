import React from 'react';
import { getSnookerShotPowerFeedback } from './snookerShotCoach.js';

const TONE_CLASSES = {
  ready: 'border-white/25 text-white',
  soft: 'border-sky-300/60 text-sky-100',
  control: 'border-amber-300/60 text-amber-100',
  power: 'border-red-400/70 text-red-100'
};

export default function SnookerShotCoach({ power = 0, portrait = false }) {
  const feedback = getSnookerShotPowerFeedback(power);

  return (
    <div
      className={`pointer-events-none flex items-center gap-2 rounded-full border bg-black/75 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur transition-colors ${TONE_CLASSES[feedback.tone]}`}
      role="status"
      aria-live="polite"
      data-shot-power-tone={feedback.tone}
    >
      <span className="text-base leading-none" aria-hidden="true">↓</span>
      <span className="flex flex-col whitespace-nowrap leading-tight">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]">{feedback.label}</span>
        <span className="text-[9px] font-semibold text-white/70">{feedback.detail}</span>
      </span>
      {!portrait && feedback.tone === 'ready' ? (
        <span className="text-[9px] text-white/55">or use arrow keys</span>
      ) : null}
    </div>
  );
}
