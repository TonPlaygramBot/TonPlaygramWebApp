/** Bounded, abortable model downloads. Retry transient gateway/network failures,
 * never parse an HTML error response or retain a request after leaving a game. */
export async function fetchGameGlb(url,{signal,attempts=3,timeoutMs=10000,maxBytes=20*1024*1024,onRetry}={}) {
  let last;
  for(let attempt=0;attempt<attempts;attempt++){
    signal?.throwIfAborted();
    const abort=new AbortController();let timedOut=false;
    const cancel=()=>abort.abort(signal.reason);
    signal?.addEventListener('abort',cancel,{once:true});
    const timer=setTimeout(()=>{timedOut=true;abort.abort();},timeoutMs);
    let retry=false;
    try{
      const response=await fetch(url,{signal:abort.signal,cache:attempt?'reload':'default'});
      if(!response.ok){
        retry=[408,429,500,502,503,504].includes(response.status);
        await response.body?.cancel();
        throw Error(`Model download returned HTTP ${response.status}`);
      }
      if(Number(response.headers.get('content-length')||0)>maxBytes){await response.body?.cancel();throw Error('Model exceeds download budget');}
      let bytes;
      const reader=response.body?.getReader();
      if(reader){
        const chunks=[];let size=0;
        try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('Model exceeds download budget');}chunks.push(part.value);}}
        finally{reader.releaseLock();}
        bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}bytes=bytes.buffer;
      }else bytes=await response.arrayBuffer();
      if(bytes.byteLength>maxBytes||bytes.byteLength<12)throw Error('Invalid model download');
      const header=new DataView(bytes);
      if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.byteLength)throw Error('Invalid model download');
      return bytes;
    }catch(error){
      signal?.throwIfAborted();
      last=timedOut?Error('Model download timed out'):error;
      retry ||= timedOut||error instanceof TypeError;
      if(!retry||attempt===attempts-1)throw last;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
    onRetry?.(attempt+2);
    await new Promise((resolve,reject)=>{
      const cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(signal.reason);};
      const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},250*(attempt+1));
      signal?.addEventListener('abort',cancel,{once:true});
      if(signal?.aborted)cancel();
    });
  }
  throw last||Error('Model download could not start');
}
