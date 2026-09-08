import {randomBytes,createHash} from 'node:crypto';
import {EXPLORE_VERSION,EXPLORE_LIMITS as L,APPEARANCES,cleanText,avatarURL,exploreInput,mediaFlags,isLive,validSignal} from '../../webapp/src/games/tirana-social/socialCore.mjs';
/** Single-process room authority. Plug into the already registered Tirana socket
 * service. No balances, career stores, client positions or match rewards. */
export function createExploreRooms({engine,resolveProfile,now=Date.now,autoTick=true,onReport=report=>console.warn('Explore report',report)}={}) {
  if(!engine||typeof resolveProfile!=='function')throw Error('Explore requires simulation and identity resolver');
  const rooms=new Map(),members=new Map(),joining=new Set(),rates=new Map();
  let stopped=false;
  const idOf=id=>createHash('sha256').update(`explore:${id}`).digest('hex').slice(0,24);
  function authorize(socket,payload) {
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid request');
    const id=String(socket.data?.playerId||''),bound=String(socket.data?.auth?.accountId||'');
    if(!id||bound!==id||String(payload.accountId||'')!==id)throw Error('Sign in on the authenticated game connection.');
    if(!payload||typeof payload!=='object'||Buffer.byteLength(JSON.stringify(payload),'utf8')>L.payloadBytes)throw Error('Invalid request');
    return id;
  }
  function rate(socket,kind,limit,period) {
    const key=`${socket.id}:${kind}`,t=now(),r=rates.get(key);
    if(!r||t-r.start>=period){rates.set(key,{start:t,n:1});return;}
    if(++r.n>limit)throw Error('Too many requests. Please wait.');
  }
  const blocked=(a,b)=>a.blocked.has(b.id)||b.blocked.has(a.id);
  function snapshot(room,me) {
    const visible=[...room.members.values()].filter(m=>m===me||!blocked(me,m));
    const keep=new Set(visible.map(m=>m.id)),state=engine.publicState(room.state);
    for(const id of Object.keys(state.players))if(!keep.has(id))delete state.players[id];
    if(state.cars)state.cars=state.cars.filter(car=>!car.driver||keep.has(car.driver));
    return {version:EXPLORE_VERSION,id:room.id,playerId:me.id,serverNow:now(),state,
      members:visible.map(m=>({id:m.id,name:m.name,avatar:m.avatar,socialId:m.socialId,appearance:m.appearance,callJoined:m.callJoined,media:{...m.media},mediaEpoch:m.mediaEpoch,socketId:m.socket.id})),
      messages:room.messages.filter(m=>keep.has(m.from)).map(m=>({...m})),blocked:[...me.blocked]};
  }
  function broadcast(room) {for(const m of room.members.values())m.socket.emit('explore:snapshot',snapshot(room,m));}
  function leave(accountId) {
    const m=members.get(accountId);if(!m)return;
    const room=rooms.get(m.roomId);members.delete(accountId);
    if(!room)return;room.members.delete(m.id);engine.removePlayer(room.state,m.id);
    m.media=mediaFlags(null);m.socket.emit('explore:left',{roomId:room.id});
    if(!room.members.size)rooms.delete(room.id);else broadcast(room);
  }
  function removeSocket(socket) {
    for(const [id,m] of members)if(m.socket===socket)leave(id);
    for(const key of rates.keys())if(key.startsWith(`${socket.id}:`))rates.delete(key);
  }
  function tick() {
    if(stopped)return;const t=now();
    for(const room of [...rooms.values()]) {
      for(const m of [...room.members.values()])if(t-m.seen>L.idleMs)leave(m.accountId);
      if(!rooms.has(room.id))continue;
      const dt=Math.max(0,Math.min(.2,(t-room.last)/1000));room.last=t;
      // Only the normal server timestep advances; no catch-up teleport after sleep.
      engine.advanceState(room.state,dt);
      if(t-room.sent>=100){room.sent=t;broadcast(room);}
    }
  }
  async function request(socket,payload={}) {
    if(stopped)throw Error('Explore unavailable');
    const accountId=authorize(socket,payload);rate(socket,'all',40,1000);
    const action=payload.action,clientId=typeof payload.clientId==='string'?payload.clientId:'';
    if(!/^[A-Za-z0-9-]{1,80}$/.test(clientId))throw Error('Missing exploration client session');
    if(action==='join') {
      rate(socket,'join',4,15000);
      const current=members.get(accountId);
      if(current){if(current.socket!==socket||current.clientId!==clientId)throw Error('Explore is already open on another connection.');return snapshot(rooms.get(current.roomId),current);}
      if(joining.has(accountId))throw Error('Joining is in progress');
      joining.add(accountId);
      try {
        const profile=await resolveProfile(accountId);
        if(stopped||socket.connected===false)throw Error('Connection closed');
        if(!profile||profile.isBanned||String(profile.accountId)!==accountId)throw Error('Account cannot join exploration');
        let room;
        if(payload.roomId){room=rooms.get(String(payload.roomId));if(!room)throw Error('Room not found');}
        else if(payload.private!==true)room=[...rooms.values()].find(r=>!r.private&&r.members.size<L.players);
        if(!room) {
          if(rooms.size>=L.rooms)throw Error('The city is busy');
          const id=randomBytes(12).toString('hex'),t=now();
          room={id,private:payload.private===true,members:new Map(),messages:[],seq:0,last:t,sent:t,state:engine.createState([], 'free-roam','explore')};rooms.set(id,room);
        }
        if(room.members.size>=L.players)throw Error('This district instance is full');
        const m={accountId,clientId,id:idOf(accountId),roomId:room.id,socket,name:cleanText(profile.nickname||profile.firstName||'Explorer',24),avatar:avatarURL(profile.photo),socialId:String(profile.telegramId||profile.accountId),appearance:APPEARANCES.includes(payload.appearance)?payload.appearance:APPEARANCES[0],media:mediaFlags(null),callJoined:false,mediaEpoch:'',blocked:new Set(),seen:now()};
        engine.addPlayer(room.state,{id:m.id,name:m.name},room.members.size);
        const p=room.state.players[m.id];p.weapon='';p.inventory={};p.wanted=0;p.cash=0;
        members.set(accountId,m);room.members.set(m.id,m);broadcast(room);return snapshot(room,m);
      } finally {joining.delete(accountId);}
    }
    const me=members.get(accountId),room=me&&rooms.get(me.roomId);
    if(!me||!room||me.socket!==socket||me.clientId!==clientId||payload.roomId!==room.id)throw Error('Join this exploration room first');
    me.seen=now();
    if(action==='leave'){leave(accountId);return {left:true};}
    if(action==='input'){engine.control(room.state,me.id,exploreInput(payload.input));return {accepted:true};}
    if(action==='interact') {
      if(!['vehicle','recover'].includes(payload.interaction))throw Error('Combat and purchases are disabled in Explore');
      engine.interact(room.state,me.id,payload.interaction);return {accepted:true};
    }
    if(action==='chat') {
      rate(socket,'chat',4,5000);const text=cleanText(payload.text,L.message);if(!text)throw Error('Write a message');
      room.messages.push({id:++room.seq,from:me.id,name:me.name,text,at:now()});if(room.messages.length>L.history)room.messages.shift();broadcast(room);return {accepted:true};
    }
    if(action==='appearance') {if(!APPEARANCES.includes(payload.appearance))throw Error('Unknown character');me.appearance=payload.appearance;broadcast(room);return {accepted:true};}
    if(action==='prepare-media') {
      me.media=mediaFlags(null);me.callJoined=false;me.mediaEpoch=randomBytes(12).toString('hex');broadcast(room);return {epoch:me.mediaEpoch};
    }
    if(action==='media') {
      const flags=mediaFlags(payload.media);
      if(isLive(flags)&&(!me.mediaEpoch||payload.epoch!==me.mediaEpoch))throw Error('Prepare a new call first');
      me.media=flags;me.callJoined=isLive(flags);if(!me.callJoined)me.mediaEpoch='';broadcast(room);return {epoch:me.mediaEpoch};
    }
    if(action==='media-state') {
      if(!me.callJoined||!me.mediaEpoch||payload.epoch!==me.mediaEpoch)throw Error('Call unavailable');
      const flags=mediaFlags(payload.media);me.media=flags;broadcast(room);return {accepted:true};
    }
    if(action==='signal') {
      rate(socket,'signal',100,10000);const peer=room.members.get(payload.to);
      if(!peer||peer===me||blocked(me,peer)||!me.callJoined||!peer.callJoined||payload.epoch!==me.mediaEpoch||payload.toEpoch!==peer.mediaEpoch||!validSignal(payload.data))throw Error('Call unavailable');
      peer.socket.emit('explore:signal',{roomId:room.id,from:me.id,epoch:me.mediaEpoch,toEpoch:peer.mediaEpoch,data:payload.data});return {accepted:true};
    }
    if(action==='block') {
      const peer=room.members.get(payload.to);if(!peer||peer===me)throw Error('Player unavailable');
      me.blocked.add(peer.id);broadcast(room);return {accepted:true};
    }
    if(action==='report') {
      rate(socket,'report',2,60000);const peer=room.members.get(payload.to);if(!peer||peer===me)throw Error('Player unavailable');
      const reason=cleanText(payload.reason,240);if(!reason)throw Error('Select a report reason');
      await onReport({roomId:room.id,from:me.accountId,to:peer.accountId,reason,at:now()});return {accepted:true};
    }
    if(action==='snapshot')return snapshot(room,me);
    throw Error('Unknown exploration action');
  }
  function attach(socket) {
    socket.on('explore:request',async(payload,ack)=>{if(typeof ack!=='function')return;try{ack({success:true,data:await request(socket,payload)});}catch(e){ack({success:false,error:e.message||'Explore request failed'});}});
    socket.on('disconnect',()=>removeSocket(socket));
  }
  const timer=autoTick?setInterval(tick,1000/30):null;timer?.unref();
  return {attach,request,tick,rooms,close(){stopped=true;if(timer)clearInterval(timer);for(const id of [...members.keys()])leave(id);rates.clear();}};
}
