import {useState} from 'react';
import {PlayerPicker} from '../../games/tiranastreets-november/PlayerPicker';
import {Link,useNavigate} from 'react-router-dom';
import '../../games/tirana-street-detail/lobby.css';
export default function TiranaStreetsLobby(){
  const navigate=useNavigate();
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
        <Link className="tsl-launch" to="/games/tiranastreets?mode=ai&activity=street-career">PLAY / CONTINUE</Link>
        <div className="tsl-feature-grid"><span><strong>DRIVE</strong>Street races & pursuits</span><span><strong>EXPLORE</strong>Urban neighborhoods & rooftops</span><span><strong>OPERATE</strong>Combat, loot & extraction</span></div>
        <small>Campaign progress saves on this device.</small>
      </article>
    </section>
    <p className="tsl-online-note" role="status">Online matches are unavailable in this restored version.</p>
  </main>;
}
