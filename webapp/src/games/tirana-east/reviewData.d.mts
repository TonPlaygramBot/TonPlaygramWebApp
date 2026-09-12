export interface ReviewView {
  name: string;
  x: number;
  z: number;
  yaw: number;
  height: number;
  distance: number;
  lift: number;
  camera?: [number, number, number];
  target?: [number, number, number];
}
/** Populated by build-tirana-east-preview.mjs for the standalone review. */
export const REVIEW: { views: ReviewView[] };
