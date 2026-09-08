import { Link, useSearchParams } from 'react-router-dom';
import BlackwaterLobby from './BlackwaterLobby.jsx';
import { LOCAL_ACTIVITIES, localActivityURL } from '../../games/tirana-street-detail/lobbyModes.mjs';
import '../../games/tirana-street-detail/lobby.css';

/** Actual /games/tiranastreets/lobby entry. The existing paid/operation flow is
 * retained intact; local careers do not enter matchmaking or carry stake data. */
export default function TiranaStreetsLobby() {
  const [params] = useSearchParams();
  return <div className="tsl-root">
    <section className="tsl-careers" aria-label="Tirana Streets game modes">
      <Link className="tsl-back" to="/games">← Games</Link>
      <p className="tsl-eyebrow">TIRANA STREETS</p>
      <h1>Your city. Your career.</h1>
      <p className="tsl-lead">Choose how to play before entering the city.</p>
      <div className="tsl-modes">
        {LOCAL_ACTIVITIES.map((item, index) => <article key={item.id} className={index ? 'tsl-card' : 'tsl-card tsl-featured'}>
          <span className="tsl-tag">{index ? 'EXPLORATION' : 'DRIVING · JOBS · PURSUITS'}</span>
          <h2>{item.title}</h2><p>{item.description}</p>
          <Link className="tsl-launch" to={localActivityURL(item.id)}>{item.action}</Link>
          <small>Free solo play · Saved on this device · No TPG stake</small>
        </article>)}
      </div>
    </section>
    <details className="tsl-operations" open={params.get('mode') === 'online'}>
      <summary>Solo operation / TPG multiplayer <span>Open operation lobby</span></summary>
      <BlackwaterLobby />
    </details>
  </div>;
}
