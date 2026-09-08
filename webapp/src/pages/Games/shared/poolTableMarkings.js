/** Keep pool-specific guides visible while suppressing snooker-only markings. */
export function showPoolGuideMarkings (markings) {
  if (!markings) return
  if (markings.group) markings.group.visible = true
  if (markings.baulkLine) markings.baulkLine.visible = true
  if (markings.dArc) markings.dArc.visible = false
  if (Array.isArray(markings.spots)) {
    markings.spots.forEach((spot) => {
      if (spot) spot.visible = spot === markings.penaltySpot
    })
  }
  if (markings.penaltySpot) markings.penaltySpot.visible = true
}
