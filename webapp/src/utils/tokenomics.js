export const TON_TO_TPC = 100;

export function tonToTpc(ton) {
  return ton * TON_TO_TPC;
}

export function tpcToTon(tpc) {
  return tpc / TON_TO_TPC;
}
