import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Game} from '../../blackwater/ui';
function Review(){
  const [session,setSession]=useState(0);
  return <Game key={session} mode="ai" onExit={()=>{history.replaceState(null,'',location.pathname);setSession(v=>v+1);}}/>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
