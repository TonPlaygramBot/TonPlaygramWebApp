import { itemInfo, type CatalogItem, type StoreItem } from './storeModel';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function validColor(value: unknown): string | undefined {
  if(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) return `#${value.toString(16).padStart(6,'0')}`;
  if(typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value.trim())) return value.trim();
  return undefined;
}
function svgText(src: unknown): string {
  if(typeof src !== 'string' || !src.startsWith('data:image/svg+xml')) return '';
  try { const i=src.indexOf(','); if(i<0 || src.slice(0,i).includes('base64')) return ''; return decodeURIComponent(src.slice(i+1)); } catch { return ''; }
}
export function isLegacySwatch(src: unknown): boolean {
  const svg = svgText(src);
  // Match only the project's known swatch template, NOT every SVG thumbnail.
  return svg.includes('cx="92" cy="82" r="120"') && svg.includes('x="40" y="168" width="176"');
}
export function itemPalette(item: CatalogItem): {colors: string[]; specified: boolean} {
  const explicit = (item.swatches || []).map(validColor).filter(Boolean) as string[];
  const thumb = typeof item.thumbnail === 'string' ? item.thumbnail : item.thumbnail?.url || item.thumbnail?.src;
  const svg = isLegacySwatch(thumb) ? svgText(thumb) : '';
  const extracted = [...svg.matchAll(/stop-color="(#[\da-f]{3,8})"/gi)].map(m=>validColor(m[1])).filter(Boolean) as string[];
  const colors = [...new Set(explicit.length ? explicit : extracted)];
  return {colors: colors.length ? colors : ['#64748b','#334155','#e2e8f0'], specified: colors.length>0};
}
export function safeImageSource(src: unknown): string {
  if(typeof src !== 'string') return '';
  const value = src.trim();
  if(!value || /[\u0000-\u001f]/.test(value) || /\.(?:hdr|exr|glb|gltf)(?:[?#]|$)/i.test(value)) return '';
  if(value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  if(/^data:image\/(?:svg\+xml|png|jpeg|webp|avif)[;,]/i.test(value)) return value;
  try { const url = new URL(value); return url.protocol==='https:' && !url.username && !url.password ? value : ''; } catch {return '';}
}
export function sourceImages(item: CatalogItem): string[] {
  const candidates = [typeof item.thumbnail==='string' ? item.thumbnail : item.thumbnail?.url || item.thumbnail?.src, item.image, item.imageUrl,item.previewImage,item.media?.image,item.media?.thumbnail,item.preview?.image,item.preview?.thumbnail,item.zoomImage];
  return [...new Set(candidates.map(safeImageSource).filter(src=>src && !isLegacySwatch(src)))];
}
export function thumbnailSvg(item: CatalogItem & {displayLabel?: string; slug?: string}): string {
  const {colors} = itemPalette(item);
  const [p,s=p,a='#e2e8f0']=colors;
  const kind = itemInfo(item).kind;
  const label = item.displayLabel || item.name;
  const isPool = ['poolroyale','bilardoshqip','snookerroyale'].includes(item.slug || '');
  const isBackgammon = item.slug === 'tavullbattleroyal';
  let shape='';
  const rect=(x:number,y:number,w:number,h:number,r:number,fill:string,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
  const circle=(x:number,y:number,r:number,fill:string,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  const dot=(x:number,y:number,r=3)=>circle(x,y,r,a);
  switch(kind) {
    case 'cue': shape=`<g transform="rotate(-32 200 145)" filter="url(#shadow)"><path d="M47 139L324 144L349 147L324 150L47 157Q38 150 47 139" fill="url(#main)"/><path d="M163 143L338 146L339 149L163 151Z" fill="#e9d7b6"/><path d="M162 143V151M153 142V152M65 140V155M72 140V155" stroke="${a}" stroke-width="3"/><path d="M85 142L133 145L87 147M87 149L134 149L88 152" fill="none" stroke="${a}" stroke-width="1.2"/><path d="M47 140L325 145" stroke="#fff" stroke-opacity=".35" stroke-width="1.3"/><path d="M340 146L349 147L349 149L340 149" fill="#60a5fa"/></g>`;break;
    case 'table': case 'cloth': case 'base': {
      const finish=kind==='table' ? 'url(#main)' : '#303a3b';
      const cloth=kind==='cloth' ? 'url(#main)' : isPool ? '#235e53' : '#364448';
      const portal=kind==='base' && String(item.optionId)==='openPortal';
      const legs=portal ? `<path d="M94 150L102 218L165 241L160 174L145 169L149 218L117 207L111 156ZM234 98L242 170L299 196L299 130L284 124L284 173L255 160L249 106Z" fill="url(#main)"/>` : `<path d="M89 151L101 227L117 223L124 159M275 146L276 219L291 224L303 153" fill="${kind==='base'?p:'#20292b'}"/>`;
      shape=`<g filter="url(#shadow)">${legs}<path d="M72 119L234 65L335 119L174 185Z" fill="${finish}"/><path d="M72 119V142L174 207V185M174 185V207L335 140V119" fill="${kind==='base'?p:s}"/><path d="M84 120L234 76L322 119L175 172Z" fill="${cloth}"/><path d="M85 120L175 173L322 120" fill="none" stroke="${a}" stroke-opacity=".35"/>`;
      if(isPool){ [[92,120],[234,80],[314,119],[175,164],[158,100],[249,144]].forEach(([x,y])=>{shape+=`<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="#0e1618"/>`;});shape+=circle(211,120,4,'#f1f5f9')+circle(235,116,4,'#d7ab51')+circle(230,123,4,'#c05e51'); }
      else shape+=`<ellipse cx="208" cy="123" rx="48" ry="21" fill="none" stroke="${a}" stroke-opacity=".25"/>`;
      shape+='</g>';break;
    }
    case 'rail': shape=`<g transform="rotate(-24 200 144)" filter="url(#shadow)">${rect(60,116,280,51,12,'url(#main)')}${rect(62,116,276,12,6,a,'opacity=".4"')}<path d="M85 142H312" stroke="${a}" stroke-width="2" opacity=".55"/>${circle(91,145,4,s)}${circle(300,145,4,s)}</g>`;break;
    case 'marker': shape=`<g transform="translate(8 0)" filter="url(#shadow)"><path d="M105 136L146 99L182 136L146 178Z" fill="url(#main)"/><path d="M212 136L253 99L289 136L253 178Z" fill="url(#main)"/><path d="M105 136L146 99L146 138Z M212 136L253 99L253 138Z" fill="${a}" opacity=".45"/></g>`;break;
    case 'pocket': shape=`<g filter="url(#shadow)"><path d="M101 119Q112 61 179 85L284 123L260 203L232 190L241 146L161 122Q128 112 128 145L133 173L105 182Q86 146 101 119" fill="url(#main)"/><path d="M111 118Q116 76 177 95L267 128" fill="none" stroke="${a}" stroke-opacity=".4" stroke-width="4"/></g>`;break;
    case 'chair': shape=`<g transform="translate(6 0)" filter="url(#shadow)"><path d="M147 170L140 232M242 162L255 223M171 175L185 219" stroke="${s}" stroke-width="10" stroke-linecap="round"/><path d="M133 153L207 124L266 157L183 191L132 167Z" fill="${s}"/><path d="M134 148L208 121L266 151L183 181L134 160Z" fill="url(#main)"/><path d="M135 150L128 67Q128 55 142 54L208 45Q225 43 225 59L229 124L185 157Z" fill="url(#main)"/><path d="M146 65L208 56M151 78L213 69" stroke="${a}" stroke-opacity=".23" stroke-width="2"/></g>`;break;
    case 'board': {
      shape=`<g transform="translate(77 54) rotate(8 122 90)" filter="url(#shadow)">${rect(-8,-8,260,186,9,s)}${rect(0,0,244,170,5,p)}`;
      if(isBackgammon){for(let i=0;i<12;i++){const x=8+i*19;shape+=`<path d="M${x} 4L${x+17} 4L${x+8} 74Z M${x} 166L${x+17} 166L${x+8} 96Z" fill="${i%2?a:s}"/>`;}}
      else if(item.slug==='airhockey' || item.type==='field'){
        shape+=`<path d="M122 0V170" stroke="${a}" stroke-width="2"/><ellipse cx="122" cy="85" rx="26" ry="22" fill="none" stroke="${a}" stroke-width="2"/><path d="M0 55Q49 85 0 115M244 55Q195 85 244 115" fill="none" stroke="${a}" stroke-width="2"/>`;
      }else if(item.slug==='fourinrowroyale'||item.slug==='snake'){
        for(let y=1;y<9;y++)shape+=`<path d="M12 ${y*17}H232" stroke="${s}"/>`;
        for(let x=1;x<13;x++)shape+=`<path d="M${x*18} 17V153" stroke="${s}"/>`;
        if(item.slug==='fourinrowroyale')for(let n=0;n<4;n++)shape+=circle(72+n*18,85,7,a);
        else shape+=`<path d="M50 130L103 48M61 137L114 55M59 116L70 123M72 96L83 103M85 76L96 83" stroke="${a}" stroke-width="3"/>`;
      }else {for(let y=0;y<8;y++)for(let x=0;x<8;x++)if((x+y)%2)shape+=rect(x*30.5,y*21.25,30.5,21.25,0,s);}
      shape+=`<path d="M0 0H244V170" fill="none" stroke="${a}" opacity=".55"/></g>`;break;
    }
    case 'chess': shape=`<g filter="url(#shadow)"><g transform="translate(69 39)"><path d="M40 152Q35 139 54 135L61 112L63 76L53 72V60L78 54L99 68L84 80L89 112L97 135Q114 142 109 152Z" fill="url(#main)"/><path d="M53 60L61 31L77 18L96 37L104 63L90 60L80 47L70 62Z" fill="url(#main)"/>${rect(35,151,80,15,7,p)}</g><g transform="translate(201 63)">${circle(38,29,18,a)}<path d="M25 50H51L45 81L59 123H18L30 81Z" fill="${a}"/>${rect(9,119,60,15,7,a)}${rect(4,133,70,15,7,s)}</g></g>`;break;
    case 'token': case 'puck': shape=`<g filter="url(#shadow)"><ellipse cx="156" cy="162" rx="65" ry="28" fill="${s}"/><path d="M91 136V162A65 28 0 0 0 221 162V136" fill="${p}"/><ellipse cx="156" cy="136" rx="65" ry="28" fill="url(#main)"/><ellipse cx="156" cy="136" rx="48" ry="20" fill="none" stroke="${a}" stroke-opacity=".7" stroke-width="2"/><ellipse cx="259" cy="177" rx="44" ry="19" fill="${s}"/><path d="M215 159V177A44 19 0 0 0 303 177V159" fill="${s}"/><ellipse cx="259" cy="159" rx="44" ry="19" fill="${a}"/></g>`;break;
    case 'mallet': shape=`<g filter="url(#shadow)"><ellipse cx="201" cy="189" rx="83" ry="33" fill="${s}"/><path d="M118 177V188A83 33 0 0 0 284 188V177" fill="${s}"/><ellipse cx="201" cy="173" rx="83" ry="33" fill="url(#main)"/><path d="M174 163V104Q174 79 201 78Q229 79 229 104V163Q202 182 174 163" fill="url(#main)"/><ellipse cx="201" cy="98" rx="27" ry="14" fill="${a}" opacity=".5"/></g>`;break;
    case 'domino': shape=`<g filter="url(#shadow)" transform="rotate(-20 200 145)">${rect(111,66,67,150,9,'url(#main)')}${rect(199,67,67,150,9,s)}<path d="M119 141H169M207 141H257" stroke="${a}" opacity=".6"/>${[[130,92],[156,120],[130,166],[156,191],[130,191],[156,166],[220,95],[244,121],[233,108],[220,169],[244,192]].map(([x,y])=>dot(x,y,4)).join('')}</g>`;break;
    case 'dice': shape=`<g filter="url(#shadow)"><path d="M111 108L187 75L252 119L178 153Z" fill="${a}"/><path d="M111 108L178 153V226L111 180Z" fill="${s}"/><path d="M178 153L252 119V192L178 226Z" fill="url(#main)"/>${circle(144,149,6,a)}${circle(143,178,6,a)}${circle(197,166,6,a)}${circle(232,159,6,a)}${circle(197,203,6,a)}${circle(232,193,6,a)}<ellipse cx="182" cy="114" rx="8" ry="5" fill="${s}"/></g>`;break;
    case 'cards': shape=`<g filter="url(#shadow)"><g transform="rotate(-20 154 146)">${rect(104,70,103,154,9,s)}${rect(111,77,89,140,6,'url(#main)','stroke="'+a+'" stroke-opacity=".55"')}<path d="M155 100L182 146L155 192L128 146Z" fill="none" stroke="${a}" stroke-width="3"/></g><g transform="rotate(13 245 145)">${rect(185,58,106,157,9,'#e6e9e5')}<text x="197" y="84" fill="${p}" font-family="Georgia,serif" font-size="22">A</text><path d="M239 106L261 141L239 176L217 141Z" fill="${p}"/><text x="267" y="205" fill="${p}" font-family="Georgia,serif" font-size="22" transform="rotate(180 270 196)">A</text></g></g>`;break;
    case 'snake': shape=`<g filter="url(#shadow)"><path d="M94 184C130 228 151 96 190 120S236 220 264 137Q284 92 301 118" fill="none" stroke="${s}" stroke-width="24" stroke-linecap="round"/><path d="M94 178C130 221 151 90 190 114S236 214 264 131Q284 86 301 112" fill="none" stroke="${p}" stroke-width="22" stroke-linecap="round"/>${circle(299,108,15,p)}${circle(304,103,3,a)}<path d="M309 113L325 117L334 111M325 117L332 123" stroke="${a}" stroke-width="2" fill="none"/></g>`;break;
    case 'environment': shape=`<g filter="url(#shadow)">${rect(54,61,292,162,14,s)}<path d="M55 62L161 109V183L55 222Z" fill="${p}"/><path d="M345 62L242 109V183L345 222Z" fill="url(#main)"/><path d="M55 222L162 181H242L345 222Z" fill="#263437"/><path d="M55 61L163 109H241L345 61" fill="none" stroke="${a}" stroke-opacity=".6"/><path d="M161 109H242V183H161Z" fill="url(#glow)"/><path d="M88 85V204M311 84V204M186 111V180M221 111V180" stroke="${a}" stroke-width="3" opacity=".55"/></g>`;break;
    case 'theme': shape=`<g filter="url(#shadow)" transform="rotate(9 199 142)">${rect(135,31,131,227,20,s)}${rect(141,37,119,215,15,'#121d20')}${rect(174,43,48,10,5,'#060d11')}${rect(153,72,94,58,10,'url(#main)')}${rect(153,142,42,47,7,p)}${rect(204,142,42,47,7,a)}${rect(153,201,93,8,4,s)}${rect(153,219,60,7,3,s)}</g>`;break;
    case 'character': shape=`<g filter="url(#shadow)">${circle(200,88,36,'url(#main)')}<path d="M121 214V188Q125 137 169 136L200 158L232 136Q277 138 280 188V214Z" fill="url(#main)"/><path d="M171 141L184 190L200 157L217 191L233 141" fill="${s}"/><path d="M201 172V214" stroke="${a}" stroke-opacity=".35" stroke-width="2"/></g>`;break;
    case 'outfit': shape=`<g filter="url(#shadow)"><path d="M145 75L113 93L79 143L125 167L141 146V220H261V146L277 167L322 143L289 93L257 75L227 93H175Z" fill="url(#main)"/><path d="M174 91Q200 117 227 91" fill="none" stroke="${a}" stroke-width="7"/><path d="M142 119V215M260 119V215" stroke="${a}" stroke-opacity=".25"/></g>`;break;
    case 'training': shape=`<g filter="url(#shadow)"><path d="M201 224C176 197 105 154 109 109C112 66 170 55 201 94C232 55 290 65 293 109C297 154 225 198 201 224Z" fill="url(#main)"/><path d="M130 111Q135 84 162 88" fill="none" stroke="${a}" stroke-opacity=".65" stroke-width="8" stroke-linecap="round"/><text x="201" y="164" text-anchor="middle" fill="${a}" font-family="Arial,sans-serif" font-size="39" font-weight="700">${esc(item.optionId)}</text></g>`;break;
    default: shape=`<g filter="url(#shadow)"><circle cx="200" cy="141" r="72" fill="url(#main)"/><ellipse cx="183" cy="111" rx="36" ry="23" fill="${a}" opacity=".3" transform="rotate(-30 183 111)"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="448" viewBox="0 0 400 280" role="img" aria-label="${esc(label)} — illustrative preview"><title>${esc(label)} — illustrative preview</title><defs><linearGradient id="bg" x2=".7" y2="1"><stop stop-color="#1d2d31"/><stop offset="1" stop-color="#10191d"/></linearGradient><linearGradient id="main" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${p}"/><stop offset=".45" stop-color="${p}"/><stop offset="1" stop-color="${s}"/></linearGradient><radialGradient id="glow"><stop stop-color="${a}" stop-opacity=".35"/><stop offset="1" stop-color="${p}" stop-opacity="0"/></radialGradient><filter id="shadow" x="-35%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="15" stdDeviation="9" flood-color="#000" flood-opacity=".45"/></filter></defs><rect width="400" height="280" fill="url(#bg)"/><ellipse cx="206" cy="139" rx="175" ry="140" fill="url(#glow)"/><path d="M0 235H400M0 253H400" stroke="#ffffff" stroke-opacity=".025"/><ellipse cx="202" cy="232" rx="119" ry="17" fill="#000" opacity=".2"/>${shape}</svg>`;
}
export const thumbnailDataUrl = (item: CatalogItem & {displayLabel?:string;slug?:string}) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumbnailSvg(item))}`;
