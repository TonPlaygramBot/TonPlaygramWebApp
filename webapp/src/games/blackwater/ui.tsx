'use client';
import {lazy,Suspense,useState,type ComponentProps} from 'react';
import {Game as OperationGame} from './operationUi';
import {CareerGame} from '../tiranastreets/career/CareerGame';
import '../tiranastreets/career/career.css';
const StreetCareer=lazy(()=>import('../tiranastreets/street-career/StreetCareerGame').then(m=>({default:m.StreetCareerGame})));
const Explore=lazy(()=>import('../tirana-social/ExploreGame').then(m=>({default:m.ExploreGame})));
export * from './operationUi';
/** Mutually exclusive runtimes. Online never mounts or imports the solo campaign.
 * Existing ?activity=career keeps opening the courier/Dajti City Stories. */
export function Game(props:ComponentProps<typeof OperationGame>){
 const [activity,setActivity]=useState(()=>{const a=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('activity'):'';return a==='explore'?'explore':a==='street-career'?'street-career':a==='career'?'stories':'operation';});
 if(props.mode==='online')return <OperationGame {...props}/>;
 if(activity==='explore')return <Suspense fallback={<p>Loading shared exploration…</p>}><Explore onExit={()=>setActivity('operation')}/></Suspense>;
 if(activity==='stories')return <CareerGame onExit={()=>setActivity('operation')}/>;
 if(activity==='street-career')return <Suspense fallback={<div className="tc-game"><p className="tc-status">Loading street career…</p></div>}><StreetCareer onExit={()=>setActivity('operation')}/></Suspense>;
 return <><OperationGame {...props}/><div style={{position:'fixed',right:12,top:148,zIndex:40,display:'grid',gap:8}}><button style={buttonStyle} onClick={()=>setActivity('street-career')}>STREET CAREER · DRIVE + COMBAT</button><button style={buttonStyle} onClick={()=>setActivity('stories')}>CITY STORIES · COURIER + DAJTI</button></div></>;
}
const buttonStyle={minHeight:44,padding:'10px 14px',borderRadius:9,background:'#193a45',color:'#eef4d8',border:'1px solid #91aca8'};
