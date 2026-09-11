/** Keep the original centre byte-for-byte. Attach source segments only where a
 * complete duplicated road segment proves the shared endpoint correspondence.
 * Never join coincident crossings or nearby endpoints by distance. */
export function extendNeighbourhood(core,region){
 const pointKey=p=>`${p[0]},${p[1]}`;
 const segmentKey=r=>[pointKey(r.a),pointKey(r.b)].sort().join('|')+`|${!!r.walk}`;
 const coreRoads=new Set(core.roads.map(segmentKey));
 const nodes=core.graph.nodes.map(p=>[...p]),edges=core.graph.edges.map(e=>[...e]),directions=edges.map(()=>0);
 const oldNodes=new Map();nodes.forEach((p,i)=>{const k=pointKey(p);if(!oldNodes.has(k))oldNodes.set(k,[]);oldNodes.get(k).push(i);});
 const proven=new Map(),conflicts=new Set();
 for(const r of region.roads){if(r.walk||r.bridge||r.tunnel||r.layer||!coreRoads.has(segmentKey(r)))continue;
  for(const [id,p] of [[r.nodeA,r.a],[r.nodeB,r.b]]){const hits=oldNodes.get(pointKey(p));if(hits?.length!==1)continue;if(proven.has(id)&&proven.get(id)!==hits[0])conflicts.add(id);else proven.set(id,hits[0]);}
 }
 for(const id of conflicts)proven.delete(id);
 const inverse=new Map();for(const [id,index] of proven){if(!inverse.has(index))inverse.set(index,[]);inverse.get(index).push(id);}
 for(const ids of inverse.values())if(ids.length>1)for(const id of ids)proven.delete(id);
 const aliasCandidates=new Map(),ambiguous=new Set();
 for(const r of region.roads){if(r.bridge||r.tunnel||r.layer||!coreRoads.has(segmentKey(r)))continue;
  for(const [id,p] of [[r.nodeA,r.a],[r.nodeB,r.b]]){const key=`${p[0]}:${p[1]}:0`;if(aliasCandidates.has(id)&&aliasCandidates.get(id)!==key)ambiguous.add(id);else aliasCandidates.set(id,key);}
 }
 const aliasReverse=new Map();for(const [id,key] of aliasCandidates){if(!aliasReverse.has(key))aliasReverse.set(key,[]);aliasReverse.get(key).push(id);}
 for(const ids of aliasReverse.values())if(ids.length>1)for(const id of ids)ambiguous.add(id);
 const sourceNodeAliases=Object.fromEntries([...aliasCandidates].filter(([id])=>!ambiguous.has(id)));
 const nodeIds=new Map(proven),edgeKeys=new Set(edges.map(([a,b])=>a<b?`${a}:${b}`:`${b}:${a}`));
 const routable=r=>!r.walk&&!r.cycle&&!r.tunnel&&!r.bridge&&r.layer===0&&!['private','no'].includes(r.access)&&!['private','no'].includes(r.motorVehicle)&&!['track','steps'].includes(r.highway);
 for(const r of region.roads.filter(routable)){
  const ids=[[r.nodeA,r.a],[r.nodeB,r.b]].map(([id,p])=>{if(!nodeIds.has(id)){nodeIds.set(id,nodes.length);nodes.push([...p]);}return nodeIds.get(id);});
  const key=ids[0]<ids[1]?ids.join(':'):[...ids].reverse().join(':');if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push(ids);directions.push(r.oneway===-1?-1:r.oneway===true||r.oneway===1?1:0);}
 }
 // Traffic and mission routing remain on the connected component containing
 // the original city; disconnected private/grade-separated data still renders.
 const adj=nodes.map(()=>[]);for(const [a,b] of edges){adj[a].push(b);adj[b].push(a);}
 const connected=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of adj[queue[i]])if(!connected.has(n)){connected.add(n);queue.push(n);}
 const remap=new Map([...connected].sort((a,b)=>a-b).map((id,i)=>[id,i]));
 const newRoads=region.roads.filter(r=>!coreRoads.has(segmentKey(r)));
 return {...core,bounds:region.bounds,roads:[...core.roads,...newRoads],buildings:[...core.buildings,...region.buildings],
  water:[...(core.water??[]),...(region.water??[]).filter(w=>w.line)],
  sourceNodeAliases,
  graph:{nodes:[...remap.keys()].map(i=>nodes[i]),edges:edges.filter(([a,b])=>remap.has(a)&&remap.has(b)).map(([a,b])=>[remap.get(a),remap.get(b)]),directions:directions.filter((_,i)=>remap.has(edges[i][0])&&remap.has(edges[i][1]))},
  regionalSource:region.source,regionalCoverage:{sourceRoads:region.roads.length,addedRoads:newRoads.length,addedBuildings:region.buildings.length,provenSeamNodes:proven.size},
  attribution:core.attribution,source:core.source,sourceSha256:core.sourceSha256};
}
