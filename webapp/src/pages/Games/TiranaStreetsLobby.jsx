import {useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import BlackwaterLobby from './BlackwaterLobby.jsx';
import {gameModeURL} from '../../games/tirana-social/socialCore.mjs';
import '../../games/tirana-street-detail/lobby.css';
const MAPS=[['skanderbeg','Skanderbeg Square'],['blloku','Blloku Night Run'],['lana','Lana Riverfront'],['pyramid','Pyramid District'],['bazaar','New Bazaar'],['stadium','Air Albania'],['station','Railway Approach'],['park','Grand Park Gate'],['embassy','Embassy Quarter'],['dajti-gate','Dajti Gateway']];
const WEAPONS=[['ar','MK18'],['smg','MP9'],['ak47','AK-47'],['shotgun','M1014'],['mosin','Mosin'],['uzi','Uzi'],['sigsauer','Sig Sauer'],['smith','S&W']];
export default function TiranaStreetsLobby(){
  const [params]=useSearchParams(),[map,setMap]=useState('skanderbeg'),[weapon,setWeapon]=useState('ar');
  const battlefield=`${gameModeURL('streets','battlefield')}&map=${map}&weapon=${weapon}`;
  return <main className="tsl-root"><section className="tsl-careers"><Link className="tsl-back" to="/games">← Games</Link><p className="tsl-eyebrow">TIRANA STREETS</p><h1>Choose your city experience.</h1><div className="tsl-modes">
    <article className="tsl-card tsl-battle"><span className="tsl-tag">10 MAPS · LOOT · EXTRACTION</span><h2>Battlefield</h2><p>Choose a Tirana district and weapon. Walk over a fallen enemy’s glowing weapon to collect it and its ammunition.</p><div className="tsl-picker"><label>MAP<select value={map} onChange={e=>setMap(e.target.value)}>{MAPS.map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label><label>WEAPON<select value={weapon} onChange={e=>setWeapon(e.target.value)}>{WEAPONS.map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label></div><Link className="tsl-launch" to={battlefield}>DEPLOY SOLO</Link><a className="tsl-back" href="#battlefield-online">Multiplayer options ↓</a></article>
    <article className="tsl-card tsl-featured"><span className="tsl-tag">FIRST-PERSON · DRIVING · COMBAT</span><h2>Career mode</h2><p>Nine chapters from the player’s eye view, on foot and inside vehicles, with saved loadouts, jobs and pursuits.</p><Link className="tsl-launch" to={gameModeURL('streets','career')}>START / CONTINUE CAREER</Link><Link className="tsl-back" to="/games/tiranastreets?mode=ai&activity=career">City Stories · Courier and Dajti</Link></article>
    <article className="tsl-card"><span className="tsl-tag">FREE ROAM · SHARED · SOCIAL</span><h2>Explore</h2><p>Enter immediately without matchmaking, or sign in to meet other players with optional chat, voice and camera.</p><Link className="tsl-launch" to={`${gameModeURL('streets','career')}&explore=1`}>EXPLORE SOLO NOW</Link><Link className="tsl-secondary" to={gameModeURL('streets','explore')}>EXPLORE TOGETHER</Link><small>Free · No TPG stake · Camera and microphone off by default</small></article>
  </div></section><details className="tsl-operations" id="battlefield-online" open={params.get('mode')==='online'}><summary>Battlefield multiplayer / operation settings</summary><BlackwaterLobby/></details></main>;
}
