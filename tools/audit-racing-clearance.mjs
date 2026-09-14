/** Run in the complete repository after installing the existing webapp deps.
 * This audit does not claim browser rendering or dynamic-actor verification.
 * Usage: node tools/audit-racing-clearance.mjs [output.json]
 */
import {writeFile} from 'node:fs/promises';
import {TRACKS,makeTrack} from '../webapp/src/games/kartroyale/simulation.mjs';
import {circuitSides} from '../webapp/src/games/kartroyale/trackEdges.mjs';
import {buildingClearance,waterClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {segmentHasClearance} from '../webapp/src/games/kartroyale/passingClearance.mjs';
import {KART_LENGTH,KART_WIDTH,MIN_PASSING_WIDTH} from '../webapp/src/games/kartroyale/racingDimensions.mjs';
const records=[];
for(const config of TRACKS){
 try{
  const track=makeTrack(config.id),edge=circuitSides(track.points,track.width/2);
  const bottlenecks=[],uncertifiedSegments=[];
  for(let i=0;i<track.points.length;i++){
   const p=track.points[i],j=(i+1)%track.points.length,q=track.points[j];
   if((p.width??track.width)<MIN_PASSING_WIDTH-1e-6)bottlenecks.push({index:i,x:p.x,z:p.z,width:p.width??track.width});
   const radius=Math.max(...[i,j].flatMap(k=>['left','right'].map(side=>Math.hypot(edge[side][k].x-track.points[k].x,edge[side][k].z-track.points[k].z))));
   const clearance=(x,z)=>Math.min(buildingClearance(x,z)-1.8,waterClearance(x,z)-.5);
   if(!segmentHasClearance(p,q,radius,clearance,.5))uncertifiedSegments.push({index:i,x:p.x,z:p.z});
  }
  records.push({id:track.id,name:track.name,samples:track.points.length,
   minimumWidth:Math.min(...track.points.map(p=>p.width??track.width)),
   widenedSamples:track.passingAudit?.widenedSamples??0,
   bottlenecks,uncertifiedSegments,
   status:bottlenecks.length||uncertifiedSegments.length?'needs-inspection':'geometry-clear'});
 }catch(error){records.push({id:config.id,status:'error',error:String(error)});}
}
const report={kart:{length:KART_LENGTH,width:KART_WIDTH},requiredWidth:MIN_PASSING_WIDTH,
 tracks:records,
 allTracksGeometricallyClear:records.length===TRACKS.length&&records.every(r=>r.status==='geometry-clear'),
 browserSceneVerified:false,
 note:'Conservative building/water swept-envelope audit. Uncertified segments need inspection and may be false positives at bridges. Dynamic actors, streamed meshes and phone rendering require a separate browser pass.'};
const json=JSON.stringify(report,null,2)+'\n';
if(process.argv[2])await writeFile(process.argv[2],json);
process.stdout.write(json);
if(!report.allTracksGeometricallyClear)process.exitCode=1;
