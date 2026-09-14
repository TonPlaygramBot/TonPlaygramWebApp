/** Logs the async boundary separately from scene construction. A stuck import
 * must be distinguishable from a missing model or a renderer failure. */
export async function loadGameMode<T>(mode:string,load:()=>Promise<T>):Promise<T> {
  const started=performance.now();
  console.info('[tirana:load]',{stage:'module',mode,status:'started'});
  try {
    const result=await load();
    console.info('[tirana:load]',{stage:'module',mode,status:'ready',elapsedMs:Math.round(performance.now()-started)});
    return result;
  } catch(error) {
    console.error('[tirana:load]',{stage:'module',mode,status:'failed',elapsedMs:Math.round(performance.now()-started)},error);
    throw error;
  }
}
