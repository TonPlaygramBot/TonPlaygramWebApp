import type { LandmarkAsset } from './placement';

/**
 * Intentionally empty: the September 7 source catalogue contains zero downloaded
 * or tested models. Do not turn source-listing URLs into runtime asset URLs.
 * Add a record only after the actual self-contained GLB, model anchor, orientation,
 * units, location, attribution, and rights have been checked. Approval here is
 * project review metadata, not a substitute for the asset owner's permission.
 */
export const APPROVED_TIRANA_LANDMARK_ASSETS: readonly LandmarkAsset[] = Object.freeze([]);
