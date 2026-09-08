import {socket,refreshSocketAuthIdentity} from '../../utils/socket.js';
import type {Input} from '../tiranastreets/shared/engine.mjs';
import type {ExploreSnapshot} from './types';
export class ExploreConnection {
  roomId=''; private clientId=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');private dead=false;private heartbeat?:ReturnType<typeof setInterval>;
  private input:Input={x:0,y:0,yaw:0,seq:0,fire:false,brake:false,fast:false};private busy=false;
  constructor(private accountId:string,private publish:(s:ExploreSnapshot)=>void,private fail:(message:string)=>void){}
  private snapshot=(s:ExploreSnapshot)=>{if(!this.dead&&s.id===this.roomId&&s.version===1)this.publish(s);};
  private disconnect=()=>{this.fail('Disconnected. Leave Explore and rejoin when your connection returns.');this.input={...this.input,x:0,y:0,brake:true};};
  private left=({roomId}:{roomId:string})=>{if(roomId===this.roomId&&!this.dead)this.fail('Exploration session ended. Rejoin from the lobby.');};
  async join(appearance:string,roomId?:string){
    refreshSocketAuthIdentity({accountId:this.accountId},{reconnect:true});
    if(!socket.connected)await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>{off();reject(Error('Game server connection timed out'));},10000);const done=()=>{off();resolve();};const off=()=>{clearTimeout(t);socket.off('connect',done);};socket.on('connect',done);socket.connect();});
    if(this.dead)return;
    await new Promise<void>((resolve,reject)=>socket.timeout(8000).emit('register',{tpcAccountNumber:this.accountId},(err:Error|null,r:{success?:boolean})=>err||!r?.success?reject(Error('Sign in to your game account first')):resolve()));
    if(this.dead)return;
    const s=await this.request('join',{appearance,roomId});
    if(this.dead){socket.emit('explore:request',{action:'leave',accountId:this.accountId,clientId:this.clientId,roomId:s.id},()=>{});return;}
    this.roomId=s.id;socket.on('explore:snapshot',this.snapshot);socket.on('disconnect',this.disconnect);socket.on('explore:left',this.left);this.snapshot(s);
    this.heartbeat=setInterval(()=>{if(this.busy||this.dead||!socket.connected)return;this.busy=true;void this.request('input',{input:this.input}).catch(e=>this.fail(e.message)).finally(()=>{this.busy=false;});},100);
  }
  request=async(action:string,payload:Record<string,unknown>={})=>{
    if(this.dead)throw Error('Explore closed');
    return new Promise<any>((resolve,reject)=>socket.timeout(8000).emit('explore:request',{...payload,action,accountId:this.accountId,clientId:this.clientId,roomId:payload.roomId||this.roomId},(err:Error|null,r:{success:boolean;data:any;error?:string})=>err||!r?.success?reject(Error(r?.error||'Explore server did not respond')):resolve(r.data)));
  };
  controls(input:Input){this.input={...input,fire:false};}
  dispose(){if(this.dead)return;this.dead=true;if(this.heartbeat)clearInterval(this.heartbeat);socket.off('explore:snapshot',this.snapshot);socket.off('disconnect',this.disconnect);socket.off('explore:left',this.left);if(this.roomId&&socket.connected)socket.emit('explore:request',{action:'leave',roomId:this.roomId,accountId:this.accountId,clientId:this.clientId},()=>{});}
}
