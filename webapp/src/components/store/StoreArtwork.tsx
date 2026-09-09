import { useEffect, useMemo, useState } from 'react';
import { itemPalette, sourceImages, thumbnailDataUrl } from './storeArtwork';
import type { StoreItem } from './storeModel';
export default function StoreArtwork({item,hero=false,onKind}:{item:StoreItem;hero?:boolean;onKind?:(illustration:boolean)=>void}) {
  const sources=useMemo(()=>sourceImages(item),[item]);
  const fallback=useMemo(()=>thumbnailDataUrl(item),[item]);
  const [index,setIndex]=useState(0);
  useEffect(()=>setIndex(0),[item.key]);
  const illustration=index>=sources.length;
  useEffect(()=>onKind?.(illustration),[illustration,onKind]);
  return <div className={`sf-art ${hero?'sf-art-hero':''}`}>
    <img src={sources[index]||fallback} alt={`${item.displayLabel}${illustration?' — illustrative preview':''}`} loading={hero?'eager':'lazy'} decoding="async" width="640" height="448" onError={()=>{if(index<sources.length)setIndex(i=>i+1);}}/>
    {illustration && <span className="sf-art-note">{itemPalette(item).specified?'Illustration':'Shape preview'}</span>}
  </div>;
}
