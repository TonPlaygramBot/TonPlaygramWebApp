const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

/** Authored aircraft face local -Z. Rotate the pilot seat with the hull, while
 * keeping look motion relative to its heading and limiting bank for comfort. */
export function pilotView(aircraft,yaw,pitch,aspect=1){
  const bank=clamp(aircraft.roll||0,-.28,.28),tilt=clamp(aircraft.pitch||0,-.15,.15);
  const local=aircraft.kind==='jet'?{x:0,y:.65,z:-2.65}:{x:.38,y:.45,z:-1.55};
  const rotate=(p)=>{
    const x=p.x*Math.cos(bank)-p.y*Math.sin(bank),y=p.x*Math.sin(bank)+p.y*Math.cos(bank);
    const yy=y*Math.cos(tilt)-p.z*Math.sin(tilt),z=y*Math.sin(tilt)+p.z*Math.cos(tilt);
    return {x:x*Math.cos(aircraft.heading)+z*Math.sin(aircraft.heading),y:yy,z:-x*Math.sin(aircraft.heading)+z*Math.cos(aircraft.heading)};
  };
  const seat=rotate(local),lookPitch=clamp(pitch,-.7,.75);
  return {
    eye:{x:aircraft.x+seat.x,y:aircraft.y+seat.y,z:aircraft.z+seat.z},
    direction:{x:-Math.sin(yaw)*Math.cos(lookPitch),y:Math.sin(lookPitch),z:-Math.cos(yaw)*Math.cos(lookPitch)},
    up:rotate({x:0,y:1,z:0}),
    fov:aspect<1?80:68
  };
}

export function flightReadout(aircraft,terrainY=0){
  const heading=((Math.round(-aircraft.heading*180/Math.PI)%360)+360)%360;
  const cardinal=['N','NE','E','SE','S','SW','W','NW'][Math.round(heading/45)%8];
  return {heading,cardinal,altitude:Math.max(0,Math.round(aircraft.y-terrainY)),speed:Math.round(Math.abs(aircraft.speed||0)*3.6),climb:Math.round(aircraft.verticalSpeed||0)};
}
