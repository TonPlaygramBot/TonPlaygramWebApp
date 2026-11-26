/** Resolve source-tagged traffic controls to the mapped inbound road leg.
 * An OSM node without a unique usable leg does not get a simulated control.
 * Physical settings are not public map data: phases are gameplay timing. */
export function resolveVerifiedSignals(nodes, fixtures, nearbyRoads, usablePole) {
  const fixtureById = new Map(fixtures.filter(p=>p.kind==='traffic_signals').map(p=>[p.id,p]));
  const matched = [];
  for (const [id, version, x, z, tags, source] of nodes) {
    const direction = tags['traffic_signals:direction'];
    if (direction !== 'forward' && direction !== 'backward') continue;
    const sourceId = 'node/'+id, fixture = fixtureById.get(sourceId);
    if (fixture && Math.hypot(fixture.point[0]-x,fixture.point[1]-z)>.6) continue;
    const roads=nearbyRoads(x,z).filter(r=>!r.walk && !r.bridge && !r.tunnel && !r.layer
      && r.w>=4 && !['no','private'].includes(r.access)
      && (direction==='forward'?String(r.nodeB)===String(id):String(r.nodeA)===String(id)&&!r.oneway));
    // A control node shared by parallel ways is not disambiguated by proximity.
    if (roads.length!==1) continue;
    const road=roads[0], incoming=direction==='forward'?road.a:road.b;
    const length=Math.hypot(incoming[0]-x,incoming[1]-z);
    if (length<1)continue;
    const ux=(incoming[0]-x)/length,uz=(incoming[1]-z)/length;
    const yaw=Math.atan2(ux,uz), offset=road.w/2+.65;
    const poleX=x+uz*offset,poleZ=z-ux*offset;
    if (!usablePole(poleX,poleZ))continue;
    matched.push({id:sourceId,name:road.name,x,z,width:road.w,yaw,axis:Math.abs(ux)>Math.abs(uz)?0:1,
      poleX,poleZ,version,tags,source,crossing:tags.crossing==='traffic_signals'});
  }
  // A bounded group shares one clock, without transitive chains down a boulevard.
  const groups=[];
  for(const s of matched){
    let group=groups.find(g=>g.members.every(p=>Math.hypot(p.x-s.x,p.z-s.z)<=34));
    if(!group){group={id:1000+groups.length,members:[]};groups.push(group);}
    group.members.push(s);
    s.junction=group.id;
  }
  return matched;
}
