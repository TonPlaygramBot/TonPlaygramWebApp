import {useState} from 'react';
import {PlayerPicker} from '../../games/tiranastreets/PlayerPicker';
import {Link,useSearchParams,useNavigate} from 'react-router-dom';
import BlackwaterLobby from './BlackwaterLobby.jsx';
import {gameModeURL} from '../../games/tirana-social/socialCore.mjs';
import '../../games/tirana-street-detail/lobby.css';
export default function TiranaStreetsLobby(){
  const [params]=useSearchParams(),navigate=useNavigate();
  const [playerReady,setPlayerReady]=useState(false);
  if(!playerReady)return <PlayerPicker onStart={()=>setPlayerReady(true)} onBack={()=>navigate('/games')}/>;
  return <main className="tsl-root">
    <section className="tsl-careers">
      <Link className="tsl-back" to="/games">← Games</Link>
      <p className="tsl-eyebrow">TIRANA STREETS</p>
      <h1>One city. Your story.</h1>
      <button className="tsl-back" onClick={()=>setPlayerReady(false)}>Change player</button>
      <article className="tsl-card tsl-featured tsl-unified">
        <span className="tsl-tag">OPEN CITY · DRIVING · COMBAT · EXTRACTION</span>
        <h2>Continue in Tirana</h2>
        <p>Story jobs, district operations and free exploration share your character, vehicles and equipment. Choose your next objective inside the city.</p>
        <Link className="tsl-launch" to={gameModeURL('streets','career')}>PLAY / CONTINUE</Link>
        <div className="tsl-feature-grid"><span><strong>DRIVE</strong>Street races & pursuits</span><span><strong>EXPLORE</strong>Urban neighborhoods & rooftops</span><span><strong>OPERATE</strong>Combat, loot & extraction</span></div>
        <small>Campaign progress saves on this device.</small>
      </article>
    </section>
    <details className="tsl-operations" id="play-with-friends" open={params.get('mode')==='online'}>
      <summary>Play with friends · online matches</summary>
      <p className="tsl-online-note">Join a live city operation. Online match results use your account; solo story progress remains saved on this device.</p>
      <BlackwaterLobby/>
    </details>
  </main>;
}
