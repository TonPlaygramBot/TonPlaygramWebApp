'use client';
import {useState,type ComponentProps} from 'react';
import {Game as OperationGame} from './operationUi';
import {CareerGame} from '../tiranastreets/career/CareerGame';
import '../tiranastreets/career/career.css';
export * from './operationUi';
/** Career and operation runtimes are mutually exclusive. Paid online matches
 * always use the existing operation path and never receive local career state. */
export function Game(props:ComponentProps<typeof OperationGame>){
 const [career,setCareer]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('activity')==='career');
 if(props.mode==='online')return <OperationGame {...props}/>;
 if(career)return <CareerGame onExit={()=>setCareer(false)}/>;
 return <><OperationGame {...props}/><button style={{position:'fixed',right:12,top:148,zIndex:40,minHeight:44,padding:'10px 14px',borderRadius:9,background:'#193a45',color:'#eef4d8',border:'1px solid #91aca8'}} onClick={()=>setCareer(true)}>CAREER · CITY STORIES</button></>;
}
