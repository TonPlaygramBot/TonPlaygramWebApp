import type {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {fetchGameGlb} from './fetchGameGlb.mjs';

/** Both FPS modes use the authored rig; the existing suited variant is a backup. */
export async function loadPlayerGltf(loader:GLTFLoader,signal:AbortSignal,progress?:(message:string)=>void) {
  const folder='/assets/tirana-streets/living/';
  for(const name of ['operator','suited-agent']){
    try{
      const bytes=await fetchGameGlb(folder+name+'.glb',{signal,attempts:name==='operator'?2:1,onRetry:()=>progress?.('Retrying your character download…')});
      return await loader.parseAsync(bytes,folder);
    }catch(error){
      signal.throwIfAborted();
      if(name==='suited-agent')throw new Error('The character files could not be downloaded. The game server may be temporarily unavailable. Retry in a moment.',{cause:error});
      progress?.('Loading the backup character…');
    }
  }
  throw Error('Character unavailable');
}
