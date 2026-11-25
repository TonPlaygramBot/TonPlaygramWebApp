import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {RadioControls} from './RadioControls';
import {VehicleRadio} from './VehicleRadio';

export function StandaloneCarRadio({active}){
  const owner=useRef(null);
  const [snapshot,setSnapshot]=useState(null);
  useLayoutEffect(()=>{
    let storage;
    try { storage=window.localStorage; } catch {}
    const radio=new VehicleRadio(storage);
    owner.current=radio;
    setSnapshot(radio.snapshot());
    return()=>{radio.dispose();owner.current=null;};
  },[]);
  useLayoutEffect(()=>{
    const radio=owner.current;
    const sync=()=>{
      radio.setContext(active&&!document.hidden);
      setSnapshot(radio.snapshot());
    };
    sync();
    document.addEventListener('visibilitychange',sync);
    const tick=active?setInterval(()=>{
      const next=radio.snapshot();
      setSnapshot(prev=>prev?.status===next.status&&prev?.station===next.station&&prev?.volume===next.volume&&prev?.enabled===next.enabled?prev:next);
    },200):null;
    return()=>{
      document.removeEventListener('visibilitychange',sync);
      if(tick!==null)clearInterval(tick);
    };
  },[active]);
  if(!active||!snapshot)return null;
  return <div className="tsc-car-radio"><RadioControls radio={snapshot} onAction={action=>{
    const radio=owner.current;if(!radio||document.hidden)return;
    if(action==='toggle')radio.toggle();
    else if(action==='next'||action==='previous')radio.next(action==='next'?1:-1);
    else radio.select(action);
    setSnapshot(radio.snapshot());
  }} onVolume={value=>{
    owner.current?.setVolume(value);
    setSnapshot(owner.current?.snapshot());
  }}/></div>;
}
