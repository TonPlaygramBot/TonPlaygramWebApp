/** Place a closed-event start on a broad, nearly straight road. The complete
 * 12-kart grid extends 63 m behind the line; leave another 9 m plus 90 m ahead
 * before a tight turn. Only rotates samples: no city geometry is changed. */
export function placeRaceStartGrid(points) {
  if (!Array.isArray(points) || points.length < 3) throw Error('Invalid race start');
  const count=points.length,wrap=i=>(i+count)%count;
  const lengths=points.map((p,i)=>Math.hypot(points[wrap(i+1)].x-p.x,points[wrap(i+1)].z-p.z));
  const angles=points.map((p,i)=>{
    const a=points[wrap(i-1)],b=points[wrap(i+1)];
    const change=Math.atan2(b.x-p.x,b.z-p.z)-Math.atan2(p.x-a.x,p.z-a.z);
    return Math.abs(Math.atan2(Math.sin(change),Math.cos(change)));
  });
  let best;
  for(let i=0;i<count;i++){
    let minimumWidth=points[i].width,turn=angles[i];
    for(const [direction,runway] of [[-1,72],[1,90]]){
      let distance=0,index=i;
      for(let step=0;step<count&&distance<runway;step++){
        const next=wrap(index+direction);
        distance+=lengths[direction<0?next:index];index=next;
        minimumWidth=Math.min(minimumWidth,points[index].width);turn+=angles[index];
      }
    }
    const score=turn*300+Math.max(0,9-minimumWidth)*60;
    if(!best||score<best.score)best={index:i,minimumWidth,turn,score};
  }
  const ordered=points.slice(best.index).concat(points.slice(0,best.index));
  let distance=0;
  for(let i=0;i<count;i++){
    const p=ordered[i],q=ordered[(i+1)%count];p.distance=distance;p.yaw=Math.atan2(q.x-p.x,q.z-p.z);
    distance+=Math.hypot(q.x-p.x,q.z-p.z);
  }
  return {points:ordered,startGrid:{minimumWidth:best.minimumWidth,turn:best.turn,behind:72,ahead:90}};
}
