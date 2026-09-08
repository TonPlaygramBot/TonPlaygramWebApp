import {useEffect,useRef,useState} from 'react';
import {socket} from '../../utils/socket.js';
import {createCaptureGuard} from './captureGuard.mjs';
import type {ExploreRequest,ExploreSnapshot} from './types';
/** Same WebRTC mesh size as the other Royal games, but with Explore membership,
 * mutual live opt-in and server-issued epochs guarding every signal. */
export function useExploreMedia(snapshot:ExploreSnapshot|null,request:ExploreRequest){
  const [local,setLocal]=useState<MediaStream|null>(null),[remote,setRemote]=useState<Record<string,MediaStream>>({}),[error,setError]=useState(''),[starting,setStarting]=useState(false);
  const ref=useRef(snapshot);ref.current=snapshot;
  const req=useRef(request);req.current=request;
  const capture=useRef(createCaptureGuard());
  const state=useRef({pending:false,generation:0,epoch:'',stream:null as MediaStream|null,peers:new Map<string,{pc:RTCPeerConnection;epoch:string;queue:RTCIceCandidateInit[]}>(),dead:false});
  function closePeer(id:string){const p=state.current.peers.get(id);if(!p)return;p.pc.close();state.current.peers.delete(id);setRemote(old=>{const next={...old};delete next[id];return next;});}
  function releaseLocal(){const s=state.current;s.generation++;s.pending=false;s.stream?.getTracks().forEach(t=>t.stop());s.stream=null;s.epoch='';for(const id of [...s.peers.keys()])closePeer(id);setLocal(null);setStarting(false);}
  async function stop(){capture.current.cancel();releaseLocal();setStarting(capture.current.busy);if(ref.current)await req.current('media',{media:{camera:false,microphone:false}}).catch(()=>{});}
  async function start(camera:boolean){
    if(!ref.current)return;const ticket=capture.current.begin();if(ticket===null)return;
    releaseLocal();const s=state.current,generation=s.generation;s.pending=true;setStarting(true);setError('');
    try{
      await req.current('media',{media:{camera:false,microphone:false}});
      if(s.dead||!capture.current.current(ticket)||s.generation!==generation)return;
      if(!navigator.mediaDevices?.getUserMedia)throw Error('Live media needs HTTPS and camera/microphone permission.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:camera?{width:{ideal:320,max:480},height:{ideal:320,max:480},frameRate:{ideal:15,max:20},facingMode:'user'}:false});
      if(s.dead||!capture.current.adopt(ticket,stream)||s.generation!==generation){stream.getTracks().forEach(t=>t.stop());return;}
      s.stream=stream;const reply=await req.current('prepare-media');
      if(s.dead||!capture.current.adopt(ticket,stream)||s.generation!==generation){stream.getTracks().forEach(t=>t.stop());return;}
      s.epoch=reply.epoch;const flags={camera:stream.getVideoTracks().some(t=>t.readyState==='live'&&t.enabled),microphone:stream.getAudioTracks().some(t=>t.readyState==='live'&&t.enabled)};if(!flags.camera&&!flags.microphone)throw Error('Media capture ended before the call joined.');await req.current('media',{epoch:s.epoch,media:flags});
      if(s.dead||!capture.current.adopt(ticket,stream)||s.generation!==generation){stream.getTracks().forEach(t=>t.stop());return;}
      setLocal(stream);
      for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(s.stream===stream)void stop();},{once:true});
    }catch(e){if(generation===s.generation){releaseLocal();setError(e instanceof Error?e.message:'Unable to join call');await req.current('media',{media:{}}).catch(()=>{});}}
    finally{capture.current.finish();if(s.generation===generation)s.pending=false;setStarting(false);}
  }
  useEffect(()=>{
    const s=state.current;s.dead=false;
    const signal=async(packet:any)=>{
      const snap=ref.current,member=snap?.members.find(m=>m.id===packet.from);
      if(!snap||packet.roomId!==snap.id||!member||!s.stream||packet.toEpoch!==s.epoch||member.mediaEpoch!==packet.epoch)return;
      const peer=ensure(member.id,member.mediaEpoch);if(!peer)return;
      try{const data=packet.data;
        if(data.type==='offer'){await peer.pc.setRemoteDescription(data.sdp);for(const ice of peer.queue.splice(0))await peer.pc.addIceCandidate(ice);const answer=await peer.pc.createAnswer();await peer.pc.setLocalDescription(answer);await send(member.id,member.mediaEpoch,{type:'answer',sdp:answer});}
        else if(data.type==='answer'){await peer.pc.setRemoteDescription(data.sdp);for(const ice of peer.queue.splice(0))await peer.pc.addIceCandidate(ice);}
        else if(data.type==='ice'){if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(data.candidate);else if(peer.queue.length<32)peer.queue.push(data.candidate);}
      }catch(e){setError('Call negotiation failed. Stop live media and retry.');if(s.peers.get(member.id)===peer)closePeer(member.id);}
    };
    const hidden=()=>{if(document.hidden)void stop();};const disconnect=()=>void stop();
    socket.on('explore:signal',signal);socket.on('disconnect',disconnect);document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',disconnect);
    return()=>{s.dead=true;void stop();socket.off('explore:signal',signal);socket.off('disconnect',disconnect);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',disconnect);};
  },[]);
  async function send(to:string,toEpoch:string,data:unknown){if(!state.current.epoch)return;await req.current('signal',{to,toEpoch,epoch:state.current.epoch,data});}
  function ensure(id:string,epoch:string){
    const s=state.current,existing=s.peers.get(id);if(existing?.epoch===epoch)return existing;
    if(existing)closePeer(id);if(!s.stream||s.peers.size>=3)return null;
    const urls=String(import.meta.env.VITE_WEBRTC_TURN_URLS||import.meta.env.VITE_WEBRTC_TURN_URL||'').split(',').map(x=>x.trim()).filter(Boolean);
    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},...(urls.length?[{urls,username:import.meta.env.VITE_WEBRTC_TURN_USERNAME||'',credential:import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL||''}]:[])]});
    const peer={pc,epoch,queue:[] as RTCIceCandidateInit[]};s.peers.set(id,peer);
    for(const track of s.stream.getTracks())pc.addTrack(track,s.stream);
    pc.onicecandidate=e=>{if(e.candidate)void send(id,epoch,{type:'ice',candidate:e.candidate.toJSON()}).catch(()=>{});};
    pc.ontrack=e=>{if(s.peers.get(id)!==peer)return;setRemote(old=>{const stream=e.streams[0]||old[id]||new MediaStream();if(!e.streams[0]&&!stream.getTracks().includes(e.track))stream.addTrack(e.track);return {...old,[id]:stream};});};
    pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState)&&s.peers.get(id)===peer)closePeer(id);};return peer;
  }
  useEffect(()=>{
    const s=state.current;if(!snapshot||!s.stream||!s.epoch)return;
    const own=snapshot.members.find(m=>m.id===snapshot.playerId);if(!own?.callJoined||own.mediaEpoch!==s.epoch)return;
    const live=snapshot.members.filter(m=>m.id!==snapshot.playerId&&m.mediaEpoch&&m.callJoined);
    for(const [id,p] of s.peers)if(!live.some(m=>m.id===id&&m.mediaEpoch===p.epoch))closePeer(id);
    for(const m of live){if(s.peers.has(m.id))continue;const peer=ensure(m.id,m.mediaEpoch);if(!peer||snapshot.playerId>m.id)continue;
      void(async()=>{try{const offer=await peer.pc.createOffer();await peer.pc.setLocalDescription(offer);await send(m.id,m.mediaEpoch,{type:'offer',sdp:offer});}catch{if(s.peers.get(m.id)===peer)closePeer(m.id);}})();
    }
  },[snapshot,local]);
  async function mute(){const s=state.current;if(!s.stream||!s.epoch)return;const audio=s.stream.getAudioTracks(),on=!audio.some(t=>t.enabled);audio.forEach(t=>{t.enabled=on;});await req.current('media-state',{epoch:s.epoch,media:{camera:s.stream.getVideoTracks().some(t=>t.enabled),microphone:on}}).catch(()=>{});}
  return {local,remote,error,starting,start,stop,mute};
}
