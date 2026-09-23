/** Keep traffic on roads with a legal route both from and back to the city.
 * The source road drawing is retained. This only removes invalid traffic spawn
 * candidates, preserving directed edges rather than reversing a one-way stub. */
export function urbanTrafficGraph(graph){
 const {nodes,edges}=graph,directions=edges.map((_,i)=>graph.directions?.[i]??0),forward=nodes.map(()=>[]),reverse=nodes.map(()=>[]);
 edges.forEach(([a,b],i)=>{if(directions[i]!==-1){forward[a].push(b);reverse[b].push(a);}if(directions[i]!==1){forward[b].push(a);reverse[a].push(b);}});
 const reachable=adj=>{const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const next of adj[queue[i]]||[])if(!seen.has(next)){seen.add(next);queue.push(next);}return seen;};
 const outward=reachable(forward),homeward=reachable(reverse),kept=nodes.map((_,i)=>i).filter(i=>outward.has(i)&&homeward.has(i)),remap=new Map(kept.map((id,i)=>[id,i]));
 const indices=edges.map((_,i)=>i).filter(i=>remap.has(edges[i][0])&&remap.has(edges[i][1]));
 return{nodes:kept.map(i=>nodes[i]),edges:indices.map(i=>edges[i].map(n=>remap.get(n))),directions:indices.map(i=>directions[i])};
}
