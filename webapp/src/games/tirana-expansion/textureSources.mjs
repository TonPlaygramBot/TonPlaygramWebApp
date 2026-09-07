/** Original deterministic 32px PBR colour tiles. PNG is encoded locally with a
 * stored DEFLATE block: no external image, canvas, dependency or imagery copy. */
function pngTile(kind){
 const raw=new Uint8Array(32*(1+32*3));let seed=27;
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=(seed%13)-6,offset=y*(1+32*3)+1+x*3;
  const mortar=kind==='brick'&&(y%8===0||(x+(Math.floor(y/8)%2)*8)%16===0);
  const base=mortar?[181,171,152]:kind==='brick'?[137,81,58]:kind==='ochre'?[204,162,102]:[209,201,181];
  for(let c=0;c<3;c++)raw[offset+c]=Math.max(0,Math.min(255,base[c]+noise));
 }
 const join=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;};
 const big=n=>new Uint8Array([n>>>24,n>>>16&255,n>>>8&255,n&255]);
 const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=n&1?(n>>>1)^0xedb88320:n>>>1;}return (n^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const body=join(new Uint8Array([...name].map(c=>c.charCodeAt(0))),data);return join(big(data.length),body,big(crc(body)));};
 let a=1,b=0;for(const v of raw){a=(a+v)%65521;b=(b+a)%65521;}
 const n=raw.length,compressed=join(new Uint8Array([120,1,1,n&255,n>>>8,(~n)&255,((~n)>>>8)&255]),raw,big((b<<16|a)>>>0));
 const bytes=join(new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',join(big(32),big(32),new Uint8Array([8,2,0,0,0]))),chunk('IDAT',compressed),chunk('IEND',new Uint8Array()));
 let encoded;if(typeof Buffer!=='undefined')encoded=Buffer.from(bytes).toString('base64');else{let s='';for(const v of bytes)s+=String.fromCharCode(v);encoded=btoa(s);}
 return `data:image/png;base64,${encoded}`;
}
export const MATERIAL_TILES=Object.freeze(Object.fromEntries(['limestone','brick','ochre'].map(k=>[k,pngTile(k)])));
