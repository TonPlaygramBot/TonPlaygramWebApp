const SEQUENCES=Object.freeze({walk:['shoulder','wide','eyes'],drive:['chase','wide','cockpit']});
export function nextView(mode,active){const views=SEQUENCES[mode];return views[(views.indexOf(active)+1)%views.length];}
export const viewLabel={eyes:'Sytë',shoulder:'Pas supit',wide:'Panoramë',chase:'Pas makinës',cockpit:'Brenda'};
export const useAvatar=(state,walkView)=>state.mode==='walk'&&walkView!=='eyes';
export const TOUR_NAMES={square:'Sheshi Skënderbej',clock:'Kulla e Sahatit',pyramid:'Piramida',myslym:'Rruga Myslym Shyri',lana:'Bulevardi Bajram Curri · Lana',brigada:'Rruga Brigada VIII · Blloku'};
export function mapSvg(city){
  const p=values=>values.map(v=>Number(v).toFixed(1)).join(' ');
  const line=r=>'M '+p(r.a)+' L '+p(r.b);
  const polygon=g=>'M '+p(g[0])+' '+g.slice(1).map(v=>'L '+p(v)).join(' ')+' Z ';
  const [x0,z0,x1,z1]=city.bounds;
  return {viewBox:[x0,z0,x1-x0,z1-z0].join(' '),district:{x:x0,z:z0,width:x1-x0,height:z1-z0},
    road:city.roads.filter(r=>!r.walk).map(line).join(' '),foot:city.roads.filter(r=>r.walk).map(line).join(' '),
    park:city.parks.map(polygon).join(' '),water:city.water.filter(w=>w.p).map(w=>polygon(w.p)).join(' '),canal:city.water.filter(w=>!w.p).map(line).join(' '),
    points:city.landmarks.filter(p=>TOUR_NAMES[p.id]).map(p=>({...p,label:TOUR_NAMES[p.id]}))};
}
export function waypoint(state,locations,id){
  const aim=locations.find(p=>p.id===id);if(!aim)return null;
  const dx=aim.x-state.x,dz=aim.z-state.z,distance=Math.hypot(dx,dz);
  const bearing=Math.atan2(dx,dz)-state.yaw;
  return {name:TOUR_NAMES[id],distance:Math.round(distance),bearing,badge:distance<=16?'Mbërrite':''};
}
