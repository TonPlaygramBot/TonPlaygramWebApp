import {TOUR_NAMES} from './roamPresentation.mjs';

// Local SVG browsing only. This geometry is not a navigation graph.
const LEGACY_KEY='tpg:tirana:places:v1';
export const FAVORITES_KEY='tpg:tirana:standalone-map:v1';
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
const canonical=id=>typeof id==='string'&&Object.hasOwn(TOUR_NAMES,id);
const normalize=ids=>[...new Set(ids.filter(canonical))];

export function mapBounds(viewBox){
  const [x,z,w,h]=viewBox.trim().split(/\s+/).map(Number);
  return {x,z,w,h};
}

export function pointerUnit(point,rect,view){
  const scale=Math.min(rect.width/view.w,rect.height/view.h);
  if(!(scale>0))return {x:.5,z:.5};
  return {x:(point.x-rect.left-(rect.width-view.w*scale)/2)/(view.w*scale),
    z:(point.y-rect.top-(rect.height-view.h*scale)/2)/(view.h*scale)};
}

export function mapTransform(bounds,view,before,after,zoom){
  const w=clamp(view.w/(zoom>0&&Number.isFinite(zoom)?zoom:1),bounds.w/8,bounds.w),h=w*bounds.h/bounds.w;
  return {x:clamp(view.x+before.x*view.w-after.x*w,bounds.x,bounds.x+bounds.w-w),
    z:clamp(view.z+before.z*view.h-after.z*h,bounds.z,bounds.z+bounds.h-h),w,h};
}

const midpoint=([a,b])=>b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a;
const spread=([a,b])=>b?Math.hypot(a.x-b.x,a.y-b.y):0;
export function transformPointers(bounds,view,first,current,rect){
  const before=pointerUnit(midpoint(first),rect,view),after=pointerUnit(midpoint(current),rect,view);
  const span=spread(first);
  // Ignore singular/tiny pinches; they still pan by midpoint.
  return mapTransform(bounds,view,before,after,span>=8?Math.max(1,spread(current))/span:1);
}

export function localMapStorage(){try{return globalThis.localStorage;}catch{return undefined;}}

export function readMapFavorites(storage){
  try{
    const saved=storage?.getItem(FAVORITES_KEY);
    if(saved!=null){
      const p=JSON.parse(saved);
      return p?.version===1&&Array.isArray(p.ids)?normalize(p.ids):[];
    }
    // Never copy legacy names or arbitrary saved coordinates. Read-only migration
    // preserves the old game's original preferences on disk.
    const old=JSON.parse(storage?.getItem(LEGACY_KEY)||'null');
    return old?.version===1&&Array.isArray(old.places)?normalize(old.places.map(p=>p?.id)):[];
  }catch{return [];}
}

export function writeMapFavorites(storage,ids){
  try{
    if(!storage)return false;
    storage.setItem(FAVORITES_KEY,JSON.stringify({version:1,ids:normalize(ids)}));
    return true;
  }catch{return false;}
}
