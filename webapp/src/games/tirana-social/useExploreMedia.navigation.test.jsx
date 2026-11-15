import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useExploreMedia} from './useExploreMedia';
vi.mock('../../utils/socket.js',()=>({socket:{on:vi.fn(),off:vi.fn()}}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host,media,request,tracks;
const snapshot={id:'city',playerId:'me',members:[{id:'me',callJoined:false,mediaEpoch:''}]};
function Harness(){media=useExploreMedia(snapshot,request);return null;}
function track(kind){return {kind,enabled:true,readyState:'live',stop:vi.fn(function(){this.readyState='ended';this.enabled=false;}),addEventListener:vi.fn()};}
beforeEach(()=>{
  tracks=[track('audio'),track('video')];const stream={getTracks:()=>tracks,getAudioTracks:()=>tracks.filter(item=>item.kind==='audio'),getVideoTracks:()=>tracks.filter(item=>item.kind==='video')};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn(async()=>stream)}});
  request=vi.fn(async action=>action==='prepare-media'?{epoch:'epoch'}:{});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function mountLive(){await act(async()=>root.render(<Harness/>));expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();await act(async()=>media.start(true));expect(media.local).toBeTruthy();}
it('leaves capture off until explicitly joining and stops every track on exit',async()=>{
  await mountLive();await act(async()=>media.stop());expect(tracks.every(item=>item.stop.mock.calls.length>0)).toBe(true);expect(media.local).toBe(null);
});
for(const [label,method,index] of [['microphone','mute',0],['camera','toggleCamera',1]]){
  it(`failed ${label}-off acknowledgement ends capture instead of turning it back on`,async()=>{
    await mountLive();request.mockImplementation(async action=>{if(action==='media-state')throw Error('timeout');return {};});await act(async()=>media[method]());expect(tracks[index].enabled).toBe(false);expect(tracks.every(item=>item.readyState==='ended')).toBe(true);expect(media.local).toBe(null);expect(media.error).toContain('Camera and microphone are off');
  });
}
it('failed camera-on acknowledgement leaves the camera disabled',async()=>{
  await mountLive();await act(async()=>media.toggleCamera());expect(tracks[1].enabled).toBe(false);
  request.mockImplementation(async action=>{if(action==='media-state')throw Error('timeout');return {};});await act(async()=>media.toggleCamera());expect(tracks[1].enabled).toBe(false);expect(media.local).toBeTruthy();
});
