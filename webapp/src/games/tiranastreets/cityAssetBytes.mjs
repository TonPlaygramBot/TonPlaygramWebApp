const MiB = 1024 * 1024;
const aborted = () => new DOMException('City asset loading was cancelled.', 'AbortError');

/** Share compressed bytes, never renderer-owned materials/skeletons. Separate
 * city layers often request the same vehicle or uniform at the same time.
 * A small LRU and three transfer lanes avoid duplicate downloads and bandwidth
 * contention; a cancelled layer cannot cancel another layer's active request. */
export function createCityAssetByteCache({maxBytes = 40 * MiB, maxEntries = 6, maxActive = 3,
  ttl = 90000, now = Date.now, fetcher = (...args) => fetch(...args)} = {}) {
  const ready = new Map(), pending = new Map(), queue = [];
  let retained = 0, active = 0;
  const drop = key => {
    const item = ready.get(key);
    if (item) {retained -= item.bytes.byteLength; clearTimeout(item.timer); ready.delete(key);}
  };
  const remember = (key, bytes) => {
    if (bytes.byteLength > maxBytes || maxEntries < 1) return;
    drop(key);
    while (ready.size >= maxEntries || retained + bytes.byteLength > maxBytes) drop(ready.keys().next().value);
    const timer = setTimeout(() => drop(key), ttl); timer.unref?.();
    ready.set(key, {bytes, expires: now() + ttl, timer}); retained += bytes.byteLength;
  };
  async function download(item) {
    const response = await fetcher(item.key, {signal:item.controller.signal, cache:item.reload?'reload':'default'});
    if (!response.ok) throw Error(`City asset download failed (HTTP ${response.status}).`);
    const bytes = await response.arrayBuffer();
    if (item.controller.signal.aborted) throw aborted();
    if (bytes.byteLength < 20) throw Error('City asset is not a complete GLB model.');
    const header = new DataView(bytes);
    if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength)
      throw Error('City asset is not a complete GLB 2.0 model.');
    remember(item.key, bytes);
    return bytes;
  }
  function pump() {
    while (active < Math.max(1,maxActive) && queue.length) {
      const item = queue.shift();
      if (item.controller.signal.aborted) {item.reject(aborted());continue;}
      active++;
      const timer = setTimeout(() => item.controller.abort(), 60000); timer.unref?.();
      download(item).then(item.resolve,item.reject).finally(() => {
        clearTimeout(timer);active--;pump();
      });
    }
  }
  function load(url, {signal, reload = false} = {}) {
    if (signal?.aborted) return Promise.reject(aborted());
    const key = String(url), cached = ready.get(key);
    if (reload || cached?.expires <= now()) drop(key);
    else if (cached) {ready.delete(key);ready.set(key,cached);return Promise.resolve(cached.bytes);}
    let request = pending.get(key);
    if (!request) {
      request = {key,reload,controller:new AbortController(),users:0,settled:false};
      const item = request;
      item.promise = new Promise((resolve,reject) => {item.resolve=resolve;item.reject=reject;}).finally(() => {
        item.settled=true;if(pending.get(key)===item)pending.delete(key);
      });
      pending.set(key,item);queue.push(item);
    }
    request.users++;
    const result = new Promise((resolve,reject) => {
      let finished = false;
      const finish = (callback,value) => {
        if(finished)return;finished=true;signal?.removeEventListener('abort',cancel);request.users--;
        if(!request.settled&&request.users===0){
          if(pending.get(key)===request)pending.delete(key);
          request.controller.abort();
        }
        callback(value);
      };
      const cancel = () => finish(reject,aborted());
      signal?.addEventListener('abort',cancel,{once:true});
      request.promise.then(bytes=>finish(resolve,bytes),error=>finish(reject,error));
      if(signal?.aborted)cancel();
    });
    pump();return result;
  }
  return {load,evict:drop,clear(){
    for(const key of ready.keys())drop(key);
    for(const item of pending.values())item.controller.abort();
    pending.clear();pump();
  },get byteLength(){return retained;},get size(){return ready.size;},get activeCount(){return active;}};
}

export const cityAssetBytes = createCityAssetByteCache();
export function loadCityAssetBytes(url, options) {
  const key=typeof window==='undefined'?String(url):new URL(url,window.location.href).href;
  return cityAssetBytes.load(key,options);
}
