import {useEffect,useRef,useState} from 'react';
import {acceptFriendRequest,listFriendRequests,listFriends,rejectFriendRequest,sendFriendRequest,socket} from './socialApi.mjs';
import {MALL_GAMES} from '../tirana-mall/mallCatalog.mjs';
import {ExploreCallDock} from './ExploreCallDock';
import type {ExploreRequest,ExploreSnapshot,GameInvitation,Member} from './types';
import type {useExploreMedia} from './useExploreMedia';
export type SocialTab='people'|'chat'|'live'|'invites';
type Media=ReturnType<typeof useExploreMedia>;

export function ExploreSocialPanel({snapshot,request,media,tab,onTab,onClose,onLaunch}:{
  snapshot:ExploreSnapshot|null;request:ExploreRequest;media:Media;tab:SocialTab;
  onTab:(tab:SocialTab)=>void;onClose:()=>void;onLaunch:(path:string)=>void;
}) {
  const me=snapshot?.members.find(member=>member.id===snapshot.playerId);
  const [text,setText]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [friends,setFriends]=useState<any[]>([]),[friendRequests,setFriendRequests]=useState<any[]>([]),[sent,setSent]=useState<Set<string>>(()=>new Set());
  const [gameId,setGameId]=useState(MALL_GAMES[0]?.slug||''),[recipient,setRecipient]=useState('');
  const version=useRef(0),log=useRef<HTMLDivElement>(null);
  const mine=me?.socialId||'';
  const peers=(snapshot?.members||[]).filter(member=>member.id!==snapshot?.playerId);
  const incoming=friendRequests.filter(item=>String(item.toId??item.to)===mine);
  const invitations=snapshot?.invitations||[];
  async function refreshFriends(){
    if(!mine)return;const id=++version.current;
    const [nextFriends,nextRequests]=await Promise.all([listFriends(mine),listFriendRequests(mine)]);
    if(version.current!==id)return;
    if(!Array.isArray(nextFriends)||!Array.isArray(nextRequests))throw Error(('error' in nextFriends&&nextFriends.error)||('error' in nextRequests&&nextRequests.error)||'Friends are unavailable. Try refreshing.');
    setFriends(nextFriends);setFriendRequests(nextRequests);
  }
  useEffect(()=>{
    const refresh=()=>void refreshFriends().catch(e=>setError(e.message));
    refresh();socket.on('friendRequest',refresh);socket.on('friendRequestAccepted',refresh);
    return()=>{version.current++;socket.off('friendRequest',refresh);socket.off('friendRequestAccepted',refresh);};
  },[mine]);
  useEffect(()=>{if(tab==='chat'&&log.current)log.current.scrollTop=log.current.scrollHeight;},[snapshot?.messages.length,tab]);
  async function run(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Action failed');}finally{setBusy(false);}}
  const isFriend=(member:Member)=>friends.some(friend=>String(friend.socialId??friend.telegramId??friend.accountId)===member.socialId);
  const isSent=(member:Member)=>sent.has(member.id)||friendRequests.some(item=>String(item.fromId??item.from)===mine&&String(item.toId??item.to)===member.socialId);
  function invitationCard(invitation:GameInvitation){
    const receiving=invitation.to===snapshot?.playerId;
    return <article className="te-invitation" key={invitation.id}>
      <b>{invitation.gameName}</b><p>{receiving?`${invitation.fromName} invited you`:`Invitation to ${invitation.toName}`} · {invitation.status}</p>
      {invitation.status==='pending'&&receiving?<div className="te-button-row"><button disabled={busy} onClick={()=>void run(async()=>{await request('game-invite-response',{id:invitation.id,accept:true});setNotice('Invitation accepted. Open the lobby when you are ready.');})}>ACCEPT</button><button disabled={busy} onClick={()=>void run(()=>request('game-invite-response',{id:invitation.id,accept:false}))}>DECLINE</button></div>:invitation.status==='accepted'?<button onClick={()=>onLaunch(invitation.path)}>MEET IN LOBBY</button>:null}
    </article>;
  }
  return <section className="te-panel te-social-panel" aria-label="Social controls">
    <div className="te-social-heading"><div><small>TIRANA · LIVE CITY</small><h1>Meet. Explore. Play.</h1></div><button onClick={onClose} aria-label="Close social controls">✕</button></div>
    <nav className="te-social-tabs" aria-label="City social tabs">{(['people','chat','live','invites'] as SocialTab[]).map(value=><button key={value} aria-pressed={value===tab} onClick={()=>onTab(value)}>{value.toUpperCase()}{value==='invites'&&invitations.some(i=>i.to===snapshot?.playerId&&i.status==='pending')?' •':''}</button>)}</nav>
    {error&&<p role="alert" className="te-inline-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {tab==='people'&&<>
      <p>Meet the people in this city instance. Friends stay connected through your TonPlayGram account.</p>
      <label>Invite a friend to this city<input readOnly value={snapshot?`${window.location.origin}/games/kartroyale?mode=ai&activity=explore&exploreRoom=${snapshot.id}`:''} onFocus={event=>event.currentTarget.select()}/></label>
      <button disabled={!snapshot} onClick={()=>void run(async()=>{if(!snapshot)return;const url=`${window.location.origin}/games/kartroyale?mode=ai&activity=explore&exploreRoom=${snapshot.id}`;await navigator.clipboard.writeText(url);setNotice('City invitation copied.');})}>COPY CITY LINK</button>
      {incoming.length>0&&<div className="te-friend-inbox"><h2>Friend requests</h2>{incoming.map(item=><article key={item.requestId||item._id}><b>{item.fromName||'Player'}</b><div className="te-button-row"><button disabled={busy} onClick={()=>void run(async()=>{await acceptFriendRequest(item.requestId||item._id);await refreshFriends();setNotice('Friend added.');})}>ACCEPT FRIEND</button><button disabled={busy} onClick={()=>void run(async()=>{await rejectFriendRequest(item.requestId||item._id);await refreshFriends();})}>DECLINE</button></div></article>)}</div>}
      <div className="te-people">{snapshot?.members.map(member=><article key={member.id}>
        <strong>{member.name}{member.id===snapshot.playerId?' (you)':isFriend(member)?' · Friend':''}</strong><small>{member.media.camera?'Camera live':member.media.microphone?'Voice live':member.callJoined?'In call · muted':'Exploring Tirana'}</small>
        {member.id!==snapshot.playerId&&<><button disabled={busy||isFriend(member)||isSent(member)} onClick={()=>void run(async()=>{await sendFriendRequest(mine,member.socialId);setSent(old=>new Set([...old,member.id]));await refreshFriends();setNotice('Friend request sent.');})}>{isFriend(member)?'FRIENDS':isSent(member)?'REQUEST SENT':'ADD FRIEND'}</button><button onClick={()=>{setRecipient(member.id);onTab('invites');}}>INVITE TO GAME</button><details><summary>Player options</summary><button disabled={busy} onClick={()=>void run(()=>request('block',{to:member.id}))}>BLOCK THIS SESSION</button><button disabled={busy} onClick={()=>void run(async()=>{await request('report',{to:member.id,reason:'Inappropriate behaviour in Explore'});setNotice('Report submitted to the server operator.');})}>REPORT</button></details></>}
      </article>)}</div>
      {friends.length>0&&<p>{friends.length} friends on your account. <a href="/messages">Open messages and friend calls</a></p>}
      <button disabled={busy} onClick={()=>void run(refreshFriends)}>REFRESH FRIENDS</button>
      <label>Your character<select value={me?.appearance||'rpm-current'} disabled={busy||!me} onChange={event=>void run(()=>request('appearance',{appearance:event.target.value}))}><option value="rpm-current">Chess avatar</option><option value="rpm-67d411-domino">Casino Check</option><option value="rpm-67f433-domino">Linen Street</option><option value="rpm-67e1b5-domino">Jacquard Night</option><option value="athlete-male">Adrian</option><option value="athlete-female">Maya</option></select></label>
    </>}
    {tab==='chat'&&<><p>Room chat is shared with the people listed in this instance.</p><div className="te-chat" role="log" aria-live="polite" ref={log}>{snapshot?.messages.length?snapshot.messages.map(message=><p key={message.id}><b>{message.name}: </b>{message.text}</p>):<p>Say hello to the city.</p>}</div><form onSubmit={event=>{event.preventDefault();void run(async()=>{await request('chat',{text});setText('');});}}><input value={text} onChange={event=>setText(event.target.value)} maxLength={280} placeholder="Message this room" aria-label="Chat message"/><button disabled={busy||!snapshot||!text.trim()}>SEND</button></form></>}
    {tab==='live'&&<><div className="te-live"><b>{media.local?'LIVE WITH THIS ROOM':'CAMERA & MICROPHONE OFF'}</b><p>{media.local?'Only people who join the call can hear and see you. Leaving or hiding the page stops capture.':'Join voice or video to speak while exploring. Camera and microphone start only when you choose.'}</p>{media.error&&<p role="alert">{media.error}</p>}
      {media.local?<><button disabled={media.changing} onClick={()=>void media.mute()}>{me?.media.microphone?'MUTE MIC':'UNMUTE MIC'}</button>{media.local.getVideoTracks().length>0?<button disabled={media.changing} onClick={()=>void media.toggleCamera()}>{me?.media.camera?'CAMERA OFF':'CAMERA ON'}</button>:<button disabled={media.starting} onClick={()=>void media.start(true)}>SWITCH TO VIDEO</button>}<button onClick={()=>void media.stop()}>END CALL</button></>:<><button disabled={media.starting||!snapshot} onClick={()=>void media.start(false)}>JOIN VOICE</button><button disabled={media.starting||!snapshot} onClick={()=>void media.start(true)}>JOIN VIDEO</button></>}
      </div><ExploreCallDock members={snapshot?.members||[]} playerId={snapshot?.playerId||''} local={media.local} remote={media.remote} expanded/><p>Video tiles remain visible while you walk or drive. Your city movement pauses while this panel is open.</p></>}
    {tab==='invites'&&<><p>Invite someone here to a game lobby. Agree on a table and any stake there; accepting this invitation spends no TPG.</p><label>Game hall<select value={gameId} onChange={event=>setGameId(event.target.value)}>{MALL_GAMES.map(game=><option key={game.slug} value={game.slug}>{game.name}</option>)}</select></label><label>Invite player<select value={recipient} onChange={event=>setRecipient(event.target.value)}><option value="">Choose someone in the city</option>{peers.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label><button disabled={busy||!gameId||!peers.some(member=>member.id===recipient)} onClick={()=>void run(async()=>{await request('game-invite',{to:recipient,gameId});setNotice('Game invitation sent.');})}>SEND GAME INVITATION</button><div>{invitations.length?invitations.map(invitationCard):<p>No active invitations. Invitations expire after two minutes.</p>}</div></>}
    <button onClick={onClose}>CLOSE PANEL</button>
  </section>;
}
