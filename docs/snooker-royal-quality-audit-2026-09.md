# Snooker Royal quality audit — September 2026

## Working brief

Act as lead game critic, mobile QA engineer and Three.js gameplay engineer. Test the complete Snooker Royal loop in portrait: entry, aim, power, spin, strike, rules, AI, camera, audio, replay, performance and failure recovery. Record only reproducible issues, rank them P0–P2, fix P0/P1 with regression tests, build, then repeat the audit on the corrected version.

## Confirmed findings in this pass

| Priority | Finding | Player impact | Resolution |
| --- | --- | --- | --- |
| P0 | The shared power control treated `pointercancel` as `pointerup`. Mobile browser/OS gesture cancellation could release an unintended shot. | A competitive shot could fire without an intentional finger release. | Cancel now releases capture, resets power and never commits or animates a shot. |
| P1 | Shot-clock expiry changed only the local HUD turn. The authoritative Snooker frame, score and active player did not advance. | AI/online turns could disagree with rules and character ownership after 60 seconds. | Expiry is now a rules-engine foul, awards the correct points, advances the frame and synchronizes online state. |
| P1 | The portrait scoreboard always rendered A then B while labeling the left side as the local player. | A player assigned seat B saw the opponent's score beside their own name. | Scores are projected by the viewer's actual seat for both 2D and arena HUDs. |
| P1 | Join/sync failure was silent and the client sent an eager initial shot packet before registration completed. | A failed online join appeared frozen with no actionable feedback. | Removed the eager packet; registration, join and sync errors now show a visible status message. |

## Release gates not closed by container automation

- Physical iOS and Android portrait touch testing across browser interruptions, notification overlays and edge swipes.
- WebGL visual review of cue/hand contact, cloth/ball readability and thermal frame pacing on low-, mid- and high-tier phones.
- Two-device online soak testing under latency, packet reordering, reconnect and server restart.
- Production load testing and authoritative anti-cheat validation for competitive TPG matches.
- Bundle-budget review: the production Snooker chunk is 483.37 kB (162.02 kB gzip) and the shared entry chunk is 2,407.47 kB (665.75 kB gzip).

## Automated evidence

- Targeted ESLint passed for `SnookerRoyal.jsx` and `snookerRoyalMatchQuality.js`.
- Seven focused Jest suites passed: 45 tests covering the new safeguards plus Snooker rules/audio/coach/table and the shared shot lifecycle.
- The full Vite production build passed.
- Browser automation was attempted twice, but its Chromium daemon was unavailable in the execution environment; no visual pass is claimed.
