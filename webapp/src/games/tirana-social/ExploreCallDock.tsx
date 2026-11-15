import {useEffect,useRef} from 'react';
import type {Member} from './types';

function CallVideo({stream}:{stream:MediaStream}) {
  const element=useRef<HTMLVideoElement>(null);
  useEffect(()=>{
    const video=element.current;if(!video)return;
    video.srcObject=stream;void video.play().catch(()=>{});
    return()=>{video.pause();video.srcObject=null;};
  },[stream]);
  // RemoteAudio owns playback once; these tiles are always silent.
  return <video ref={element} autoPlay playsInline muted/>;
}

export function ExploreCallDock({members,playerId,local,remote,onControls,expanded=false}:{
  members:Member[];playerId:string;local:MediaStream|null;remote:Record<string,MediaStream>;
  onControls?:()=>void;expanded?:boolean;
}) {
  const joined=members.filter(member=>member.callJoined||member.id===playerId&&local);
  if(!joined.length)return null;
  return <section className={`te-call-dock${expanded?' te-call-expanded':''}`} aria-label="Live city call">
    <div className="te-call-heading"><b>LIVE CITY CALL</b>{onControls&&<button onClick={onControls}>CONTROLS</button>}</div>
    <div className="te-call-tiles">{joined.map(member=>{
      const mine=member.id===playerId,stream=mine?local:remote[member.id];
      return <article className="te-call-tile" key={member.id}>
        {member.media.camera&&stream?<CallVideo stream={stream}/>:<span className="te-call-avatar">{member.avatar?<img src={member.avatar} alt=""/>:member.name.slice(0,1).toUpperCase()}</span>}
        <span>{member.name}{mine?' (you)':''}<small>{!local&&!mine?'Join call to connect':!stream&&!mine?'Connecting…':member.media.microphone?'Mic on':'Mic muted'}</small></span>
      </article>;
    })}</div>
  </section>;
}
