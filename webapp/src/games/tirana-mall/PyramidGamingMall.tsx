import {useEffect,useMemo,useRef,useState} from 'react';
import {MALL_SHOPS} from './mallShops.mjs';
import {MALL_GAMES} from './mallCatalog.mjs';
import {PyramidMallScene,type MallDestination} from './PyramidMallScene';
import './pyramidMall.css';
const halls:MallDestination[]=MALL_GAMES.map(game=>({id:game.slug,name:game.name,route:game.route,image:game.image,description:game.description}));
const shops:MallDestination[]=[...MALL_SHOPS];
export function PyramidGamingMall({onClose,onLaunch}:{onClose:()=>void;onLaunch:(route:string)=>void}){
  const host=useRef<HTMLDivElement>(null),scene=useRef<PyramidMallScene|null>(null),choose=useRef<(id:string)=>void>(()=>{});
  const [floor,setFloor]=useState<'games'|'shops'>('games'),[selected,setSelected]=useState(''),[directory,setDirectory]=useState(true),[query,setQuery]=useState(''),[error,setError]=useState('');
  const items=floor==='games'?halls:shops,active=items.find(item=>item.id===selected);
  const filtered=useMemo(()=>items.filter(item=>item.name.toLowerCase().includes(query.toLowerCase())),[items,query]);
  choose.current=id=>{setSelected(id);setDirectory(false);scene.current?.visit(id);};
  useEffect(()=>{if(!host.current)return;let renderer:PyramidMallScene|undefined;try{renderer=new PyramidMallScene(host.current,id=>choose.current(id),setError);scene.current=renderer;}catch(e){setError(`3D view unavailable. Use the directory to enter any hall or shop. ${e instanceof Error?e.message:''}`);}return()=>{renderer?.dispose();scene.current=null;};},[]);
  useEffect(()=>{setSelected('');setQuery('');scene.current?.setDestinations(items,floor==='shops');},[floor]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if((event.target as HTMLElement)?.closest('input,button,select,textarea'))return;if(event.key==='ArrowUp'||event.key.toLowerCase()==='w'){event.preventDefault();scene.current?.walk(1);setSelected('');}if(event.key==='ArrowDown'||event.key.toLowerCase()==='s'){event.preventDefault();scene.current?.walk(-1);setSelected('');}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  return <section className="tpg-mall" aria-label="TonPlayGram Pyramid Gaming Mall">
    <div ref={host} className="tpg-mall-canvas" aria-label="3D gaming halls"/>
    <header className="tpg-mall-header"><div><small>PYRAMID · TIRANA</small><h1>TonPlayGram<span>Gaming Mall</span></h1></div><button onClick={onClose}>EXIT MALL</button></header>
    <nav className="tpg-mall-floors" aria-label="Mall floors"><button aria-pressed={floor==='games'} onClick={()=>{setFloor('games');setDirectory(true);}}>GAME HALLS · {halls.length}</button><button aria-pressed={floor==='shops'} onClick={()=>{setFloor('shops');setDirectory(true);}}>SHOPS · {shops.length}</button><button aria-expanded={directory} onClick={()=>setDirectory(open=>!open)}>DIRECTORY</button></nav>
    {error&&<p className="tpg-mall-error" role="status">{error}</p>}
    {directory?<div className="tpg-mall-directory"><div className="tpg-mall-directory-title"><div><small>{floor==='games'?'GROUND FLOOR':'MEZZANINE'}</small><h2>{floor==='games'?'A hall for every game.':'Make the game yours.'}</h2></div><button aria-label="Close mall directory" onClick={()=>setDirectory(false)}>×</button></div><p>{floor==='games'?'Choose a hall, look around, then enter its game lobby.':'Equipment and customization from the full store, including non-gift items. Purchases stay in the existing checkout.'}</p><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={floor==='games'?'Find a game hall':'Find a shop'} aria-label="Search mall"/><div className="tpg-mall-grid">{filtered.map(item=><button key={item.id} onClick={()=>choose.current(item.id)}><span className="tpg-mall-number">{String(items.indexOf(item)+1).padStart(2,'0')}</span><strong>{item.name}</strong><small>{floor==='games'?'Explore hall →':`${item.count} items →`}</small></button>)}</div>{!filtered.length&&<p>No matching halls. Try another name.</p>}</div>:<>
      <div className="tpg-mall-walk" aria-label="Mall walking controls"><button aria-label="Walk forward in mall" onClick={()=>{scene.current?.walk(1);setSelected('');}}>WALK FORWARD ↑</button><button aria-label="Walk back in mall" onClick={()=>{scene.current?.walk(-1);setSelected('');}}>WALK BACK ↓</button><button onClick={()=>{scene.current?.lobby();setSelected('');}}>ATRIUM</button></div>
      {active?<article className="tpg-mall-selection"><small>{floor==='games'?'GAME HALL':'STORE BOUTIQUE'}</small><h2>{active.name}</h2><p>{active.description}</p><button className="tpg-mall-launch" onClick={()=>onLaunch(active.route)}>{floor==='games'?'ENTER GAME LOBBY':'OPEN SHOP'}</button><button onClick={()=>setDirectory(true)}>CHOOSE ANOTHER {floor==='games'?'HALL':'SHOP'}</button></article>:<p className="tpg-mall-hint">Tap a hall sign or open the directory. Walk along the central aisle to explore.</p>}
    </>}
  </section>;
}
