// Screen timing only; gameplay continues to use the original raycast.
export const FLIGHT_CUT_SECONDS = .66;
const clamp01 = (value:number) => Math.max(0,Math.min(1,value));
const smooth = (value:number) => {
  const x = clamp01(value);
  return x*x*(3-2*x);
};
export function flightPresentation(age:number) {
  const t = clamp01(age / FLIGHT_CUT_SECONDS);
  return {
    travel: .04 + .89 * smooth(t),
    blend: smooth(t/.19) * smooth((1-t)/.22)
  };
}
