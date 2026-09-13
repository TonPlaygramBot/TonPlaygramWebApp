import {useEffect, useState} from 'react';

/** Loading a game must leave a working route back to the lightweight lobby. */
export function TiranaLoading({onBack}: {onBack: () => void}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);
  return <section style={{minHeight:'100dvh',padding:'max(32px, env(safe-area-inset-top)) 20px',background:'#102b35',color:'#fff4dd',fontFamily:'system-ui,sans-serif'}}>
    <h1>Tirana Streets</h1>
    <p role="status">{slow ? 'Game files are taking longer than usual. You can return to the lobby and try again.' : 'Loading Tirana Streets…'}</p>
    <button type="button" onClick={onBack} style={{minHeight:48,padding:'12px 20px',borderRadius:10,border:0,background:'#d6e5b2',color:'#1b302a',fontWeight:700}}>Return to lobby</button>
  </section>;
}
