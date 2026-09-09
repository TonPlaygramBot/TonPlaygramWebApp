import {socket,refreshSocketAuthIdentity} from '../../utils/socket.js';
import type {Input} from '../tiranastreets/shared/engine.mjs';
import type {ExploreSnapshot} from './types';
export type ExploreStatus='idle'|'connecting'|'joining'|'ready'|'disconnected'|'error'|'closed';
/** Owns one logical Explore session, not the shared application socket.
 * Reconnects register/join again. Old callbacks cannot revive a disposed session.
 * Controls use a single monotonic counter, independent of clocks and input UI. */
export class ExploreConnection {
  roomId=''; status:ExploreStatus='idle';
  private readonly clientId=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  private dead=false; private wanted=false; private generation=0; private sequence=0;
  private appearance='rpm-current'; private invitation?:string;
  private flight:Promise<void>|null=null; private heartbeat?:ReturnType<typeof setInterval>;
  private busy=false; private lastSnapshot=0;
  private cancellations=new Set<(error:Error)=>void>();
  private input:Input={x:0,y:0,yaw:0,seq:0,fire:false,brake:true,fast:false};
  constructor(private accountId:string,private publish:(s:ExploreSnapshot)=>void,
    private fail:(message:string)=>void,private publishStatus:(s:ExploreStatus)=>void=()=>{}) {
    socket.on('connect',this.connected);socket.on('disconnect',this.disconnected);
    socket.on('explore:snapshot',this.receive);socket.on('explore:left',this.left);
  }
  private state(next:ExploreStatus){this.status=next;this.publishStatus(next);}
  private receive=(s:ExploreSnapshot)=>{
    if(this.dead||this.status!=='ready'||s?.id!==this.roomId||s.version!==1)return;
    this.lastSnapshot=Date.now();this.publish(s);
  };
  private connected=()=>{if(this.wanted&&!this.dead&&!this.flight)void this.retry().catch(()=>{});};
  private disconnected=()=>{
    if(this.dead||!this.wanted)return;
    this.generation++;this.state('disconnected');this.controls({...this.input,x:0,y:0,fast:false,brake:true});
    for(const cancel of [...this.cancellations])cancel(Error('Connection interrupted'));
    this.fail('Connection lost. Reconnecting to Explore…');
  };
  private left=({roomId}:{roomId:string})=>{
    if(!this.dead&&this.status==='ready'&&roomId===this.roomId){this.state('error');this.fail('This Explore session ended. Tap Reconnect to join again.');}
  };
  private waitForSocket(){
    if(socket.connected)return Promise.resolve();
    return new Promise<void>((resolve,reject)=>{
      const finish=(error?:Error)=>{clearTimeout(timer);socket.off('connect',done);socket.off('connect_error',failed);this.cancellations.delete(cancel);error?reject(error):resolve();};
      const done=()=>finish(),failed=(e:Error)=>finish(Error(e?.message||'Game server connection failed'));
      const cancel=(e:Error)=>finish(e),timer=setTimeout(()=>finish(Error('Game server connection timed out')),10000);
      this.cancellations.add(cancel);socket.on('connect',done);socket.on('connect_error',failed);socket.connect();
    });
  }
  private emit(event:string,payload:Record<string,unknown>,generation=this.generation):Promise<any>{
    if(this.dead||!socket.connected)return Promise.reject(Error('Explore is offline. Reconnect before sending actions.'));
    return new Promise((resolve,reject)=>{
      let settled=false;
      const cancel=(e:Error)=>{if(settled)return;settled=true;this.cancellations.delete(cancel);reject(e);};
      this.cancellations.add(cancel);
      socket.timeout(8000).emit(event,payload,(err:Error|null,r:{success?:boolean;data?:any;error?:string})=>{
        // A cancelled permission/render lifecycle may finish joining on the server
        // later. Client fencing makes this leave harmless to a replacement tab.
        if(this.dead&&payload.action==='join'&&r?.success&&r.data?.id&&socket.connected)
          socket.emit('explore:request',{action:'leave',accountId:this.accountId,clientId:this.clientId,roomId:r.data.id},()=>{});
        if(settled)return;
        if(this.dead||generation!==this.generation){cancel(Error('Explore request cancelled'));return;}
        if(err||!r?.success){cancel(Error(r?.error||'Explore server did not respond. Check that the matching server update is deployed.'));return;}
        settled=true;this.cancellations.delete(cancel);resolve(r.data??r);
      });
    });
  }
  async join(appearance:string,roomId?:string){
    if(this.dead)throw Error('Explore closed');
    this.appearance=appearance;this.invitation=roomId;
    // Refresh once before starting the lifecycle: a shared-socket identity refresh
    // must not interrupt our own in-flight registration on every retry.
    if(!this.wanted)refreshSocketAuthIdentity({accountId:this.accountId},{reconnect:true});
    this.wanted=true;return this.retry();
  }
  retry=():Promise<void>=>{
    if(this.dead)return Promise.reject(Error('Explore closed'));
    if(this.flight)return this.flight;
    const generation=this.generation;
    const current=Promise.resolve().then(async()=>{
      this.state('connecting');await this.waitForSocket();
      if(this.dead||generation!==this.generation)throw Error('Explore join cancelled');
      await this.emit('register',{tpcAccountNumber:this.accountId},generation);
      this.state('joining');
      const packet=(roomId?:string)=>({action:'join',accountId:this.accountId,clientId:this.clientId,appearance:this.appearance,roomId:roomId||''});
      let result:ExploreSnapshot;
      try{result=await this.emit('explore:request',packet(this.invitation||this.roomId),generation);}
      catch(e){
        // A public instance with no remaining members is removed by the server.
        // Never silently move an explicit invitation into a different room.
        if(this.invitation||!(e instanceof Error)||e.message!=='Room not found')throw e;
        result=await this.emit('explore:request',packet(),generation);
      }
      if(this.dead||generation!==this.generation)throw Error('Explore join cancelled');
      if(result?.version!==1||!result.id||!result.playerId||!result.state)throw Error('Invalid Explore server response');
      this.roomId=result.id;this.state('ready');this.fail('');this.receive(result);
      if(!this.heartbeat)this.heartbeat=setInterval(()=>void this.tick(),100);
    }).catch(e=>{
      if(!this.dead&&generation===this.generation){this.state('error');this.fail(e instanceof Error?e.message:'Explore failed');}
      throw e;
    }).finally(()=>{
      if(this.flight===current)this.flight=null;
      if(!this.dead&&this.wanted&&socket.connected&&this.status==='disconnected')queueMicrotask(this.connected);
    });
    this.flight=current;return current;
  };
  private async tick(){
    if(this.busy||this.dead||this.status!=='ready'||!socket.connected)return;
    this.busy=true;
    try{
      if(Date.now()-this.lastSnapshot>5000)this.receive(await this.request('snapshot'));
      else await this.request('input',{input:this.input});
    }catch(e){if(!this.dead&&this.status==='ready'){this.state('error');this.fail(e instanceof Error?e.message:'Explore connection stalled');}}
    finally{this.busy=false;}
  }
  request=async(action:string,payload:Record<string,unknown>={})=>{
    if(this.dead||this.status!=='ready'||!socket.connected)throw Error('Explore is offline. Reconnect before sending actions.');
    const result=await this.emit('explore:request',{...payload,action,accountId:this.accountId,clientId:this.clientId,roomId:this.roomId});
    if(action==='appearance'&&typeof payload.appearance==='string')this.appearance=payload.appearance;
    return result;
  };
  controls(input:Input){this.input={...input,fire:false,seq:++this.sequence};}
  dispose(){
    if(this.dead)return;this.dead=true;this.wanted=false;this.generation++;
    if(this.heartbeat)clearInterval(this.heartbeat);
    socket.off('connect',this.connected);socket.off('disconnect',this.disconnected);
    socket.off('explore:snapshot',this.receive);socket.off('explore:left',this.left);
    for(const cancel of [...this.cancellations])cancel(Error('Explore closed'));
    // Empty roomId also cancels a server join still awaiting profile resolution.
    if(socket.connected)socket.emit('explore:request',{action:'leave',accountId:this.accountId,clientId:this.clientId,roomId:this.roomId},()=>{});
    this.state('closed');
  }
}
