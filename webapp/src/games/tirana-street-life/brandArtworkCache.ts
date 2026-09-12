/** Shared decoded artwork, bounded independently of the number of mapped shops.
 * Requests start only when a sign enters the selected nearby set. */
export function createBrandArtworkCache(maxConcurrent=4,maxCached=32,createImage:()=>HTMLImageElement=()=>new Image()){
 const cached=new Map<string,HTMLImageElement>();
 const pending=new Map<string,Promise<HTMLImageElement|null>>();
 const queue:{url:string;resolve:(image:HTMLImageElement|null)=>void}[]=[];
 let active=0;
 const pump=()=>{
  while(active<maxConcurrent&&queue.length){
   const {url,resolve}=queue.shift()!;active++;
   const image=createImage();let finished=false;
   const finish=(success:boolean)=>{
    if(finished)return;finished=true;image.onload=null;image.onerror=null;active--;pending.delete(url);
    if(success){cached.delete(url);cached.set(url,image);while(cached.size>maxCached)cached.delete(cached.keys().next().value!);}
    resolve(success?image:null);pump();
   };
   image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0);
   image.onerror=()=>finish(false);
   image.src=url;
  }
 };
 const load=(url:string):Promise<HTMLImageElement|null>=>{
  const image=cached.get(url);if(image){cached.delete(url);cached.set(url,image);return Promise.resolve(image);}
  const existing=pending.get(url);if(existing)return existing;
  let resolve!:(image:HTMLImageElement|null)=>void;
  const result=new Promise<HTMLImageElement|null>(r=>{resolve=r;});pending.set(url,result);queue.push({url,resolve});pump();return result;
 };
 return {load,stats:()=>({active,queued:queue.length,cached:cached.size})};
}
export const loadBrandArtwork=createBrandArtworkCache().load;
