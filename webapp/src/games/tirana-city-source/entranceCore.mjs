/** Merge only contiguous collinear footprint edges. Never bridge a courtyard. */
export function facadeRuns(edges){
  const runs=[];
  for(const e of edges){const previous=runs.at(-1);
    if(previous&&previous.nx*e.nx+previous.nz*e.nz>.9995&&Math.hypot(previous.b[0]-e.a[0],previous.b[1]-e.a[1])<.05){
      previous.b=[...e.b];previous.length=Math.hypot(previous.b[0]-previous.a[0],previous.b[1]-previous.a[1]);
      previous.ux=(previous.b[0]-previous.a[0])/previous.length;previous.uz=(previous.b[1]-previous.a[1])/previous.length;
      previous.x=(previous.a[0]+previous.b[0])/2;previous.z=(previous.a[1]+previous.b[1])/2;
    }else runs.push({...e,a:[...e.a],b:[...e.b]});
  }return runs;
}
/** Most exterior compatible wall wins before length; recessed wings cannot win. */
export function exteriorFrontage(edges,direction=[-1,0]){
  return facadeRuns(edges).filter(e=>e.length>4&&e.nx*direction[0]+e.nz*direction[1]>.8)
    .sort((a,b)=>(b.x*direction[0]+b.z*direction[1])-(a.x*direction[0]+a.z*direction[1])||b.length-a.length)[0];
}
export const ROGNER_MAIN_ENTRANCE={node:'6498475597',lat:41.3207042,lon:19.8208973,source:'https://www.openstreetmap.org/node/6498475597'};
