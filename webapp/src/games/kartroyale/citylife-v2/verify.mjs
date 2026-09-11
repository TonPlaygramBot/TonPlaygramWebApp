/** Reject corrupt assets and external dependencies before handing bytes to GLTFLoader. */
export async function verifyAsset(buffer,asset){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength!==asset.bytes||buffer.byteLength<20)throw Error('V2 asset size mismatch: '+asset.id);
 const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw Error('Invalid V2 GLB: '+asset.id);
 const end=20+view.getUint32(12,true);if(end>buffer.byteLength)throw Error('Invalid V2 GLB JSON range');
 const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,end-20)));
 for(const key of ['buffers','images'])for(const resource of doc[key]||[])if(resource.uri)throw Error('V2 must be self-contained: '+asset.id);
 if(!globalThis.crypto?.subtle)throw Error('V2 integrity verification requires a secure browser context');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==asset.sha256)throw Error('V2 checksum mismatch: '+asset.id);
}
