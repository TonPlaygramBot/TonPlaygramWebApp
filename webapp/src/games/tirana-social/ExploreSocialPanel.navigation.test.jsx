import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ExploreSocialPanel} from './ExploreSocialPanel';
import {MALL_GAMES} from '../tirana-mall/mallCatalog.mjs';
const api=vi.hoisted(()=>({acceptFriendRequest:vi.fn(),listFriendRequests:vi.fn(),listFriends:vi.fn(),rejectFriendRequest:vi.fn(),sendFriendRequest:vi.fn()}));
const socket=vi.hoisted(()=>({on:vi.fn(),off:vi.fn()}));
vi.mock('../../utils/api.js',()=>api);
vi.mock('../../utils/socket.js',()=>({socket}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const member=(id,name)=>({id,name,socialId:id,appearance:'rpm-current',avatar:'',socketId:id,callJoined:false,media:{camera:false,microphone:false},mediaEpoch:''});
let host,root,props;
beforeEach(()=>{
  vi.clearAllMocks();api.listFriends.mockResolvedValue([]);api.listFriendRequests.mockResolvedValue([]);api.sendFriendRequest.mockResolvedValue({});api.acceptFriendRequest.mockResolvedValue({});api.rejectFriendRequest.mockResolvedValue({});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  props={snapshot:{id:'city',playerId:'alice',members:[member('alice','Alice'),member('bob','Bob')],messages:[],invitations:[]},request:vi.fn().mockResolvedValue({}),media:{local:null,remote:{},error:'',starting:false,changing:false,start:vi.fn(),stop:vi.fn(),mute:vi.fn(),toggleCamera:vi.fn()},tab:'people',onTab:vi.fn(),onClose:vi.fn(),onLaunch:vi.fn()};
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(){await act(async()=>root.render(<ExploreSocialPanel {...props}/>));}
async function click(label){const button=[...host.querySelectorAll('button')].find(item=>item.textContent===label);expect(button,`button ${label}`).toBeTruthy();await act(async()=>button.click());}
function change(select,value){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}));}

it('joins no media on mount and starts camera only through the video action',async()=>{
  props.tab='live';await render();expect(props.media.start).not.toHaveBeenCalled();await click('JOIN VIDEO');expect(props.media.start).toHaveBeenCalledWith(true);
});
it('adds a real friend request and disables repeat requests',async()=>{
  await render();await click('ADD FRIEND');expect(api.sendFriendRequest).toHaveBeenCalledWith('alice','bob');expect([...host.querySelectorAll('button')].find(button=>button.textContent==='REQUEST SENT').disabled).toBe(true);
});
it('shows only incoming friend requests for acceptance and refreshes accepted friendships',async()=>{
  api.listFriendRequests.mockResolvedValue([{requestId:'incoming',toId:'alice',fromId:'bob',fromName:'Bob'},{requestId:'outgoing',toId:'charlie',fromId:'alice',fromName:'Alice'}]);
  await render();expect([...host.querySelectorAll('button')].filter(button=>button.textContent==='ACCEPT FRIEND')).toHaveLength(1);
  api.listFriends.mockResolvedValue([{socialId:'bob'}]);api.listFriendRequests.mockResolvedValue([]);await click('ACCEPT FRIEND');expect(api.acceptFriendRequest).toHaveBeenCalledWith('incoming');expect(host.textContent).toContain('Bob · Friend');
});
it('invites only a present selected member using the canonical game id',async()=>{
  props.tab='invites';await render();const send=[...host.querySelectorAll('button')].find(button=>button.textContent==='SEND GAME INVITATION');expect(send.disabled).toBe(true);
  await act(async()=>change(host.querySelectorAll('select')[1],'bob'));await click('SEND GAME INVITATION');expect(props.request).toHaveBeenCalledWith('game-invite',{to:'bob',gameId:MALL_GAMES[0].slug});expect(host.textContent).toContain('accepting this invitation spends no TPG');
});
it('acceptance is explicit and opening an accepted invitation navigates to its lobby',async()=>{
  props.tab='invites';const invitation={id:'invite-1',from:'bob',to:'alice',fromName:'Bob',toName:'Alice',gameId:'poolroyale',gameName:'Pool Royale',path:'/games/poolroyale/lobby',status:'pending'};
  props.snapshot.invitations=[invitation];await render();await click('ACCEPT');expect(props.request).toHaveBeenCalledWith('game-invite-response',{id:'invite-1',accept:true});expect(props.onLaunch).not.toHaveBeenCalled();
  props.snapshot={...props.snapshot,invitations:[{...invitation,status:'accepted'}]};await render();await click('MEET IN LOBBY');expect(props.onLaunch).toHaveBeenCalledWith('/games/poolroyale/lobby');
});
it('sends chat text and clears it only after server acknowledgement',async()=>{
  props.tab='chat';await render();const input=host.querySelector('input');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Hello Tirana');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(props.request).toHaveBeenCalledWith('chat',{text:'Hello Tirana'});expect(input.value).toBe('');
});
