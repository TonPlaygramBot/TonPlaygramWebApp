import {Link,useSearchParams} from 'react-router-dom';
import BlackwaterLobby from './BlackwaterLobby.jsx';
import {gameModeURL} from '../../games/tirana-social/socialCore.mjs';
import '../../games/tirana-street-detail/lobby.css';
export default function TiranaStreetsLobby(){
  const [params]=useSearchParams();
  return <main className="tsl-root"><section className="tsl-careers"><Link className="tsl-back" to="/games">← Games</Link><p className="tsl-eyebrow">TIRANA STREETS</p><h1>Choose your city experience.</h1><div className="tsl-modes">
    <article className="tsl-card"><span className="tsl-tag">COMBAT · WAVES · EXTRACTION</span><h2>Battlefield</h2><p>Existing first-person operations. Play solo or use the multiplayer lobby below.</p><Link className="tsl-launch" to={gameModeURL('streets','battlefield')}>SOLO BATTLEFIELD</Link><a className="tsl-back" href="#battlefield-online">Multiplayer options ↓</a></article>
    <article className="tsl-card tsl-featured"><span className="tsl-tag">DRIVING · JOBS · PURSUITS</span><h2>Career mode</h2><p>Your existing nine-chapter open-world campaign, saved loadout and progression.</p><Link className="tsl-launch" to={gameModeURL('streets','career')}>START / CONTINUE CAREER</Link><Link className="tsl-back" to="/games/tiranastreets?mode=ai&activity=career">City Stories · Courier and Dajti</Link></article>
    <article className="tsl-card"><span className="tsl-tag">PEACEFUL · SHARED · SOCIAL</span><h2>Explore</h2><p>Meet players from both games in Tirana. Chat, send friend requests and choose avatar-only, voice or live camera.</p><Link className="tsl-launch" to={gameModeURL('streets','explore')}>EXPLORE TOGETHER</Link><small>Free · No TPG stake · Camera and microphone off by default</small></article>
  </div></section><details className="tsl-operations" id="battlefield-online" open={params.get('mode')==='online'}><summary>Battlefield multiplayer / operation settings</summary><BlackwaterLobby/></details></main>;
}
