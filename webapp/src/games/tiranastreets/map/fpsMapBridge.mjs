/** The active Tirana Streets game uses the FPS layout's translated coordinates.
 * Do not put translated positions in geographic favourites or map routing. */
export function worldPlayer(player,yaw,origin){return {x:player.x+origin.x,z:player.z+origin.z,heading:yaw};}
export function sceneRoute(points,origin,height=.22){return points.flatMap(p=>[p.x-origin.x,height,p.z-origin.z]);}
export function openMapSession(engine){
  const resume=engine.phase==='playing'&&!engine.online;
  engine.pause();let closed=false;
  return {close(){if(closed)return;closed=true;if(resume&&engine.phase==='paused')engine.resume();}};
}
