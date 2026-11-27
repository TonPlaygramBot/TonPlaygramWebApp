import {buildRaceCatalog} from './raceCatalog.mjs';

export const LANA_BOULEVARD_PREVIEW_ID = 'tirana-lana-fishta-bajram-curri-preview-v1';
// Source-graph faces 0393f2285180fbc3 + 85769e2d3219a835 from draft #26179.
// Deliberately separate from URBAN_RACE_ROUTES: never admitted to the public catalog.
const route = {
  "name": "Lana · Fishta–Bajram Curri",
  "points": [
    [-452.63, 548.93],
    [-464.66, 551.39],
    [-542.91, 567.83],
    [-633.54, 586.88],
    [-641.01, 588.44],
    [-658.05, 592.14],
    [-662.38, 593.05],
    [-679.81, 596.68],
    [-700.04, 600.88],
    [-711.82, 603.33],
    [-802.22, 621.77],
    [-882.73, 639.24],
    [-1015.31, 666.83],
    [-1031.75, 670.25],
    [-1089.3, 682.21],
    [-1109.76, 686.47],
    [-1114.8, 687.52],
    [-1117.19, 680.35],
    [-1117.48, 679.49],
    [-1118.4, 676.7],
    [-1127.19, 650.1],
    [-1128.26, 647.04],
    [-1130.54, 640.11],
    [-1125.87, 639.27],
    [-1112.56, 636.43],
    [-1097.79, 633.53],
    [-1056.5, 624.86],
    [-1009.48, 614.89],
    [-998.66, 612.64],
    [-962.88, 605.2],
    [-924.53, 597.14],
    [-904.35, 592.9],
    [-893.64, 590.65],
    [-778.52, 566.47],
    [-694.75, 548.89],
    [-650.26, 539.56],
    [-642.42, 537.89],
    [-637.62, 536.89],
    [-597.73, 528.51],
    [-563.14, 521.24],
    [-514.72, 511.1],
    [-477.23, 503.31],
    [-462.73, 500.34],
    [-448.03, 497.07],
    [-444.4, 496.28],
    [-416.19, 490.13],
    [-370.59, 480.67],
    [-327.36, 471.33],
    [-289.81, 463.83],
    [-122.71, 428.75],
    [-113.08, 426.75],
    [-111.98, 432.33],
    [-111.68, 433.91],
    [-105.33, 466.35],
    [-104.8, 469.05],
    [-103.57, 475.31],
    [-115.73, 477.87],
    [-175.46, 490.55],
    [-235.76, 503.2],
    [-281.01, 512.7],
    [-340.7, 525.27],
    [-439.77, 546.21]
  ],
  "streets": [
    "Bulevardi Bajram Curri",
    "Bulevardi Gjergj Fishta",
    "Rruga Ibrahim Rugova",
    "Rruga Muhamet Gjollesha",
    "Rruga Sulejman Delvina"
  ],
  "length": 2172.2974235852716,
  "originalLength": 2172.2974235852716,
  "routeClass": "main-roads",
  "routeStats": {
    "minimumSourceWidth": 6.2,
    "broadRoadShare": 0.6416,
    "averageSourceWidth": 8.58
  }
};

let preview;
export function loadLanaBoulevardPreview(intent) {
  const {mode,optIn,id}=intent ?? {};
  if (mode !== 'local-geometry-preview' || optIn !== true || id !== LANA_BOULEVARD_PREVIEW_ID) return null;
  if (!preview) {
    const catalog = buildRaceCatalog({TRACKS:[], CUPS:[], normalizeTrack:value => value}, [], [],
      [{...route, id:LANA_BOULEVARD_PREVIEW_ID}]);
    const track = catalog.makeTrack(LANA_BOULEVARD_PREVIEW_ID);
    // No online launch, payout, or career/ghost-record writer is linked.
    preview = Object.freeze({...track, previewOnly:true, onlineEligible:false, recordEligible:false});
  }
  return preview;
}
