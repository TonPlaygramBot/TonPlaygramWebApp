/** Photo-informed original sculpture, based on the credited 2007 and 2017
 * Commons views in docs/tirana-street-life.md. Unseen anatomy is interpreted.
 * Horse faces -Z. Its RIGHT foreleg (+X) is raised; three hooves meet the slab. */
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a);return a.map(v=>v/(d||1));},dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

/** Smooth anatomical cross-sections instead of intersecting spherical joints.
 * Each row is [x,y,z,horizontalRadius,otherRadius]. End caps stay flat. */
function loft(b,rows,axis,detail,material='bronze',segments=detail?20:9){
 const rings=[];
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<(detail?3:1);j++){
  const t=j/(detail?3:1),a=rows[Math.max(0,i-1)],c=rows[i],d=rows[i+1],e=rows[Math.min(rows.length-1,i+2)];
  rings.push(c.map((v,k)=>.5*((2*v)+(-a[k]+d[k])*t+(2*a[k]-5*v+4*d[k]-e[k])*t*t+(-a[k]+3*v-3*d[k]+e[k])*t*t*t)));
 }
 rings.push(rows.at(-1));
 const points=rings.flatMap(r=>Array.from({length:segments},(_,i)=>{const a=i*2*Math.PI/segments,rx=Math.max(.006,r[3]),ry=Math.max(.006,r[4]);return axis==='z'?[r[0]+rx*Math.cos(a),r[1]+ry*Math.sin(a),r[2]]:[r[0]+rx*Math.cos(a),r[1],r[2]+ry*Math.sin(a)];}));
 const faces=[],normals=points.map(()=>[0,0,0]);
 const tri=(ia,ib,ic)=>{
  let n=cross(sub(points[ib],points[ia]),sub(points[ic],points[ia]));
  const ring=rings[Math.floor(ia/segments)],rad=sub(points[ia],ring.slice(0,3));
  if(dot(n,rad)<0){[ib,ic]=[ic,ib];n=n.map(v=>-v);}
  if(Math.hypot(...n)<1e-9)return;faces.push([ia,ib,ic]);for(const i of [ia,ib,ic])for(let k=0;k<3;k++)normals[i][k]+=n[k];
 };
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){const a=i*segments+j,c=i*segments+(j+1)%segments,d=c+segments,e=a+segments;tri(a,c,d);tri(a,d,e);}
 const smooth=normals.map(unit);
 for(const f of faces){const normal=unit(cross(sub(points[f[1]],points[f[0]]),sub(points[f[2]],points[f[0]])));b.tri(material,...f.map(i=>points[i]),f.map(i=>dot(normal,smooth[i])>1e-5?smooth[i]:normal));}
 for(const end of [0,rings.length-1]){
  const c=rings[end].slice(0,3),towards=sub(c,rings[end===0?1:end-1].slice(0,3));
  for(let j=0;j<segments;j++){let a=points[end*segments+j],d=points[end*segments+(j+1)%segments];if(dot(cross(sub(a,c),sub(d,c)),towards)<0)[a,d]=[d,a];b.tri(material,c,a,d);}
 }
}

function roughBlock(b,x,y,z,w,h,d,seed,detail){
 // Shared corners form a closed stone; internal cracks are course joints.
 const n=detail?4:1,grid=(axis,side)=>{
  const u=(axis+1)%3,v=(axis+2)%3,size=[w,h,d],centre=[x,y+h/2,z];
  return Array.from({length:n+1},(_,i)=>Array.from({length:n+1},(_,j)=>{
   const p=[...centre];p[axis]+=side*size[axis]/2;p[u]+=(i/n-.5)*size[u];p[v]+=(j/n-.5)*size[v];
   if(i>0&&i<n&&j>0&&j<n)p[axis]+=side*(hash(seed+i*9+j*19+axis*37)-.48)*Math.min(.24,size[axis]*.12);
   p[1]=Math.max(0,p[1]);return p;
  }));
 };
 for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
  const p=grid(axis,side);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
   const a=p[i][j],c=p[i+1][j],d=p[i+1][j+1],e=p[i][j+1];
   if(side===1)b.quad('pale',a,c,d,e);else b.quad('pale',a,e,d,c);
  }
 }
}

export const SKANDERBEG_POSE=Object.freeze({slabTop:3.52,raisedForeleg:'right',groundedHooves:[[-.57,3.52,-1.28],[-.62,3.52,1.33],[.68,3.52,1.71]],raisedHoof:[.62,5.1,-1.96],saberTip:[.77,10.94,.38]});

export function skanderbeg(b,detail){
 for(let course=0;course<4;course++){
  const w=4.6-course*.37,d=7.0-course*.47,y=course*.85;
  if(detail)for(let ix=0;ix<2;ix++)for(let iz=0;iz<4;iz++){
   const bw=w/2-.03,bd=d/4-.025;
   roughBlock(b,(ix-.5)*w/2,y,(iz-1.5)*d/4,bw,.83,bd,course*91+ix*17+iz*53,true);
  }else b.frustum('pale',w,d,y,.85,w-.14,d-.16);
 }
 b.box('bronze',2.95,.12,4.9,0,3.46,-.03);
 const sph=(p,r,mat='bronze')=>b.sphere(mat,p,r,detail?16:8,detail?10:5);
 const tube=(a,c,r,s=r,mat='bronze')=>b.tube(mat,a,c,r,s,detail?10:6);
 // Barrel, haunches and shoulders share one continuous silhouette.
 loft(b,[[0,6.19,1.89,.08,.18],[0,6.22,1.57,.63,.7],[0,6.14,.96,.83,.92],[0,6.08,.13,.82,.99],[0,6.2,-.62,.71,.94],[0,6.36,-1.08,.56,.79],[0,6.54,-1.34,.2,.4]],'z',detail);
 loft(b,[[0,6.23,-.86,.53,.71],[0,6.63,-1.06,.61,.65],[0,7.2,-1.37,.48,.51],[0,7.78,-1.61,.34,.38],[0,8.17,-1.78,.27,.28],[0,8.29,-1.82,.1,.14]],'y',detail);
 // Long cheek and down-turned muzzle, rather than a round animal head.
 loft(b,[[0,8.3,-1.89,.23,.31],[0,8.14,-2.04,.29,.35],[0,7.86,-2.17,.27,.3],[0,7.5,-2.34,.2,.23],[0,7.31,-2.36,.23,.17],[0,7.22,-2.34,.14,.09]],'y',detail);
 for(const x of [-.22,.22]){
  loft(b,[[x,8.2,-1.76,.13,.11],[x*1.2,8.47,-1.75,.095,.06],[x*1.35,8.64,-1.83,.007,.007]],'y',detail);
  if(detail){sph([x*1.22,8.03,-2.04],[.065,.065,.07],'shadow');sph([x*.96,7.4,-2.49],[.055,.045,.02],'shadow');}
 }
 // Three weight-bearing limbs; asymmetric hocks and one flexed foreleg.
 loft(b,[[-.55,6.35,-.85,.29,.38],[-.56,5.74,-.96,.2,.22],[-.55,4.88,-1.12,.115,.13],[-.58,4.04,-1.29,.08,.095],[-.57,3.72,-1.22,.12,.13]],'y',detail);
 loft(b,[[.53,6.38,-.96,.28,.36],[.6,6.12,-1.42,.22,.2],[.67,6.01,-2.06,.14,.14],[.69,5.81,-2.18,.105,.13],[.66,5.46,-2.1,.08,.1],[.62,5.25,-1.93,.12,.12]],'y',detail);
 loft(b,[[-.5,6.29,1.27,.34,.48],[-.64,5.55,1.16,.29,.3],[-.7,4.9,.83,.17,.21],[-.54,4.32,1.34,.1,.12],[-.62,3.72,1.35,.105,.12]],'y',detail);
 loft(b,[[.5,6.24,1.36,.36,.47],[.69,5.61,1.65,.29,.34],[.78,5.03,1.44,.16,.17],[.75,4.45,1.72,.095,.12],[.68,3.72,1.76,.1,.12]],'y',detail);
 for(const [x,y,z] of SKANDERBEG_POSE.groundedHooves)loft(b,[[x,y,z-.08,.18,.25],[x,y+.12,z-.03,.16,.21],[x,y+.25,z+.05,.11,.11]],'y',detail);
 loft(b,[[.62,5.1,-1.96,.15,.18],[.62,5.24,-1.94,.17,.21],[.62,5.38,-1.92,.09,.11]],'y',detail);
 loft(b,[[0,6.55,1.64,.17,.16],[.06,6.4,2.09,.21,.2],[.12,5.82,2.27,.23,.16],[.12,5.12,2.58,.19,.15],[-.07,4.71,2.84,.1,.07],[-.22,4.6,2.94,.007,.007]],'y',detail);
 // Mane follows the upper crest of the arched neck, in sculpted scallops.
 for(let i=0;i<(detail?17:8);i++){
  const t=i/(detail?16:7);sph([0,6.95+t*1.34,-.92-t*.64],[.09,.13,.17]);
 }
 // Saddle cloth is a draped surface across the barrel; stitched edges in near LOD.
 for(const side of [-1,1]){
  b.quad('bronze',[side*.15,7.14,-.64],[side*.24,7.18,.8],[side*.9,6.3,.75],[side*.82,6.43,-.61]);
  b.quad('bronze',[side*.82,6.43,-.61],[side*.9,6.3,.75],[side*.24,7.18,.8],[side*.15,7.14,-.64]);
  if(detail){tube([side*.83,6.45,-.61],[side*.92,6.32,.74],.045);tube([side*.77,6.46,-.64],[side*.81,6.24,.63],.025);}
 }
 sph([0,7.08,.04],[.62,.2,.8]);
 // Riding boots, bent thighs and feet resting in stirrups.
 for(const side of [-1,1]){
  loft(b,[[side*.36,7.61,.18,.24,.26],[side*.69,7.14,-.21,.28,.27],[side*.87,6.67,-.38,.2,.2],[side*.83,6.19,-.43,.15,.18],[side*.8,5.79,-.63,.13,.16]],'y',detail);
  sph([side*.81,5.7,-.77],[.17,.15,.34]);
  if(detail){tube([side*.95,5.58,-1.01],[side*.95,5.56,-.45],.045);tube([side*.95,5.58,-.48],[side*.95,6.65,-.3],.025);}
 }
 loft(b,[[0,7.32,.11,.44,.37],[0,7.72,.1,.51,.39],[0,8.15,.09,.57,.39],[0,8.57,.08,.6,.37],[0,8.77,.12,.42,.29],[0,8.84,.12,.21,.19]],'y',detail);
 // Heavy asymmetric cape, with folds and an irregular hanging edge.
 const cols=detail?20:8,rows=detail?14:5;
 const cape=(i,j,back=0)=>{const u=i/cols*2-1,v=j/rows,w=.54+.43*v;return [u*w,8.73-v*(2.1+.45*Math.max(0,-u)),.29+.43*Math.sqrt(Math.max(0,1-u*u))+.12*v+Math.sin(u*17)*.065*v+back];};
 for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
  b.quad('bronze',cape(i,j),cape(i,j+1),cape(i+1,j+1),cape(i+1,j));
  b.quad('bronze',cape(i+1,j,.025),cape(i+1,j+1,.025),cape(i,j+1,.025),cape(i,j,.025));
 }
 // Neck, individual facial masses, full moustache/beard and low helmet.
 tube([0,8.7,.1],[0,9.02,.08],.2,.18);
 loft(b,[[0,8.99,.02,.18,.19],[0,9.18,-.025,.29,.26],[0,9.43,.015,.29,.255],[0,9.63,.055,.24,.19]],'y',detail);
 if(detail){
  loft(b,[[0,9.43,-.22,.066,.046],[0,9.25,-.31,.075,.09],[0,9.18,-.3,.1,.055]],'y',true);
  for(const side of [-1,1]){sph([side*.135,9.4,-.231],[.077,.045,.035],'shadow');sph([side*.3,9.29,.06],[.053,.115,.075]);tube([side*.02,9.17,-.28],[side*.17,9.14,-.27],.05,.035);}
 }
 loft(b,[[0,9.22,-.14,.28,.23],[0,8.99,-.2,.26,.22],[0,8.87,-.31,.19,.15],[0,8.87,-.44,.07,.04]],'y',detail);
 b.sphere('bronze',[0,9.58,.045],[.34,.2,.3],detail?20:10,detail?8:4,true);
 tube([0,9.58,.045],[0,9.63,.045],.34,.34);
 // Goat-head crest with swept horns (not an oversized antler crown).
 sph([0,9.85,-.015],[.13,.16,.16]);sph([0,9.84,-.18],[.09,.09,.14]);
 for(const x of [-.095,.095]){tube([x,9.89,.01],[x*1.6,10.06,.2],.055,.035);tube([x*1.6,10.06,.2],[x*1.2,10.14,.35],.035,.008);}
 // Left rein hand in front; right fist holds the vertical curved saber.
 loft(b,[[-.47,8.62,.07,.21,.23],[-.65,8.26,-.2,.19,.2],[-.5,8.0,-.66,.13,.14],[-.34,8.02,-.83,.1,.11]],'y',detail);
 sph([-.32,8.02,-.85],[.14,.13,.13]);
 loft(b,[[.47,8.59,.09,.23,.25],[.75,8.27,.02,.2,.19],[.82,7.92,-.26,.14,.15],[.72,8.02,-.36,.12,.12]],'y',detail);
 sph([.73,8.05,-.37],[.15,.13,.12]);
 tube([.76,7.86,-.37],[.76,8.42,-.37],.047);tube([.76,8.35,-.61],[.76,8.35,-.14],.045,.045);
 const blade=[[8.34,-.38,.14],[9.07,-.29,.17],[9.84,-.12,.16],[10.49,.1,.11],[10.94,.38,.002]];
 for(let i=0;i<blade.length-1;i++){
  const [y,z,w]=blade[i],[yy,zz,ww]=blade[i+1];
  b.quad('bronze',[.74,y,z-w/2],[.74,yy,zz-ww/2],[.74,yy,zz+ww/2],[.74,y,z+w/2]);
  b.quad('bronze',[.79,y,z+w/2],[.79,yy,zz+ww/2],[.79,yy,zz-ww/2],[.79,y,z-w/2]);
  b.quad('bronze',[.74,y,z-w/2],[.79,y,z-w/2],[.79,yy,zz-ww/2],[.74,yy,zz-ww/2]);
  b.quad('bronze',[.74,y,z+w/2],[.74,yy,zz+ww/2],[.79,yy,zz+ww/2],[.79,y,z+w/2]);
 }
 if(detail){
  for(const side of [-1,1]){
   const x=side*.3;
   tube([x,8.19,-1.87],[x,7.35,-2.39],.027);
   tube([x,7.49,-2.39],[side*.42,7.19,-1.53],.026);tube([side*.42,7.19,-1.53],[-.32,8.02,-.85],.026);
   tube([side*.53,6.89,-.73],[side*.66,6.22,-1.31],.08);tube([side*.66,6.22,-1.31],[side*.42,6.06,-1.42],.08);
   for(let i=0;i<5;i++)sph([side*(.44+i*.046),6.14+i*.09,-1.39+i*.04],[.06,.08,.065]);
   for(let i=0;i<4;i++)tube([side*.62,6.2+i*.09,-1.28+i*.03],[side*.65,5.96+i*.06,-1.3+i*.03],.027,.012);
  }
  for(let i=0;i<10;i++)tube([-.22+i*.05,9.09,-.33],[(-.22+i*.05)*.6,8.89,-.44],.016,.007);
 }
}
