// UI media are owned by the mounted game, not by a Telegram profile.
export function attachSnakeSoundBank(entries,{volume,muted},AudioType=globalThis.Audio){
  if(typeof AudioType!=='function')return ()=>{};
  const owned=entries.map(([ref,src])=>{
    const sound=new AudioType();
    sound.preload='none';
    sound.src=src;
    sound.volume=volume;
    sound.muted=muted;
    ref.current=sound;
    return [ref,sound];
  });
  return ()=>{
    for(const [ref,sound] of owned){
      sound.pause();
      sound.removeAttribute('src');
      if(ref.current===sound)ref.current=null;
    }
  };
}
