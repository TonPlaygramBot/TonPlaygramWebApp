import type {Track} from './simulation.mjs';
export const LANA_BOULEVARD_PREVIEW_ID:'tirana-lana-fishta-bajram-curri-preview-v1';
type PreviewTrack = Track & {readonly previewOnly:true; readonly onlineEligible:false; readonly recordEligible:false};
export function loadLanaBoulevardPreview(intent?:{
  mode?:string;optIn?:boolean;id?:string;
}):PreviewTrack|null;
