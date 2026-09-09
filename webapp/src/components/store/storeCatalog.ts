import { POOL_ROYALE_STORE_ITEMS, POOL_ROYALE_OPTION_LABELS } from '../../config/poolRoyaleInventoryConfig.js';
import { SNOOKER_ROYALE_STORE_ITEMS, SNOOKER_ROYALE_OPTION_LABELS } from '../../config/snookerRoyalInventoryConfig.js';
import { AIR_HOCKEY_STORE_ITEMS, AIR_HOCKEY_OPTION_LABELS } from '../../config/airHockeyInventoryConfig.js';
import { CHESS_BATTLE_STORE_ITEMS, CHESS_BATTLE_ROYAL_STORE_ITEMS, CHESS_BATTLE_OPTION_LABELS, CHESS_BATTLE_ROYAL_OPTION_LABELS } from '../../config/chessBattleInventoryConfig.js';
import { FOUR_IN_ROW_BATTLE_STORE_ITEMS, FOUR_IN_ROW_BATTLE_OPTION_LABELS } from '../../config/fourInRowInventoryConfig.js';
import { TAVULL_BATTLE_STORE_ITEMS, TAVULL_BATTLE_OPTION_LABELS } from '../../config/tavullBattleInventoryConfig.js';
import { LUDO_BATTLE_STORE_ITEMS, LUDO_BATTLE_OPTION_LABELS } from '../../config/ludoBattleInventoryConfig.js';
import { MURLAN_ROYALE_STORE_ITEMS, MURLAN_ROYALE_OPTION_LABELS } from '../../config/murlanInventoryConfig.js';
import { DOMINO_ROYAL_STORE_ITEMS, DOMINO_ROYAL_OPTION_LABELS } from '../../config/dominoRoyalInventoryConfig.js';
import { SNAKE_STORE_ITEMS, SNAKE_OPTION_LABELS } from '../../config/snakeInventoryConfig.js';
import { TEXAS_HOLDEM_STORE_ITEMS, TEXAS_HOLDEM_OPTION_LABELS } from '../../config/texasHoldemInventoryConfig.js';
import { TABLE_CLOTH_OPTIONS } from '../../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../../utils/murlanTable.js';
import { APP_THEME_STORE_ITEMS } from '../../utils/appTheme.js';
import { entitlementKey, itemInfo, legacyStorePrice, type CatalogItem, type StoreItem } from './storeModel';

type Labels = Record<string,Record<string,string>>;
export interface StoreGame { slug:string; name:string; shortName:string; symbol:string; items:CatalogItem[]; labels:Labels }
const checkersTables = [
  {id:'ovalTable',label:'Oval Table',shape:'grandOval'},
  {id:'diamondEdge',label:'Diamond Edge Table',shape:'diamondEdge'},
  {id:'hexagonTable',label:'Hexagon Table',shape:'hexagonTable'}
].map((table,idx)=>({id:`checkers-table-${table.id}`,type:'tables',optionId:table.id,name:table.label,price:980+idx*45,description:`${table.label} layout for Checkers Battle Royal.`,thumbnail:TABLE_SHAPE_OPTIONS.find(option=>option.id===table.shape)?.thumbnail,previewShape:'table'}));
// These are the same procedural additions made by the previous Store.jsx.
const checkersCloths=TABLE_CLOTH_OPTIONS.slice(1).map((option,idx)=>({id:`checkers-cloth-${option.id}`,type:'tableCloth',optionId:option.id,name:option.label,price:360+idx*35,description:'Table cloth option for procedural checkers tables.',thumbnail:option.thumbnail,previewShape:'table'}));
export const STORE_GAMES: StoreGame[] = [
  {slug:'home',name:'Home Themes',shortName:'Home',symbol:'◈',items:APP_THEME_STORE_ITEMS,labels:{}},
  {slug:'poolroyale',name:'Pool Royale',shortName:'Pool',symbol:'⑧',items:POOL_ROYALE_STORE_ITEMS,labels:POOL_ROYALE_OPTION_LABELS},
  {slug:'bilardoshqip',name:'Bilardo Shqip',shortName:'Bilardo',symbol:'⑧',items:POOL_ROYALE_STORE_ITEMS,labels:POOL_ROYALE_OPTION_LABELS},
  {slug:'snookerroyale',name:'Snooker Royal',shortName:'Snooker',symbol:'●',items:SNOOKER_ROYALE_STORE_ITEMS,labels:SNOOKER_ROYALE_OPTION_LABELS},
  {slug:'airhockey',name:'Air Hockey',shortName:'Hockey',symbol:'◎',items:AIR_HOCKEY_STORE_ITEMS,labels:AIR_HOCKEY_OPTION_LABELS},
  {slug:'chessbattleroyal',name:'Chess Battle Royal',shortName:'Chess',symbol:'♞',items:CHESS_BATTLE_ROYAL_STORE_ITEMS,labels:CHESS_BATTLE_ROYAL_OPTION_LABELS},
  {slug:'checkersbattleroyal',name:'Checkers Battle Royal',shortName:'Checkers',symbol:'◉',items:[...CHESS_BATTLE_STORE_ITEMS,...checkersTables,...checkersCloths],labels:CHESS_BATTLE_OPTION_LABELS},
  {slug:'fourinrowroyale',name:'4 in a Row',shortName:'4 in a Row',symbol:'▦',items:FOUR_IN_ROW_BATTLE_STORE_ITEMS,labels:FOUR_IN_ROW_BATTLE_OPTION_LABELS},
  {slug:'tavullbattleroyal',name:'Backgammon Royal',shortName:'Backgammon',symbol:'◭',items:TAVULL_BATTLE_STORE_ITEMS,labels:TAVULL_BATTLE_OPTION_LABELS},
  {slug:'ludobattleroyal',name:'Ludo Battle Royal',shortName:'Ludo',symbol:'✣',items:LUDO_BATTLE_STORE_ITEMS,labels:LUDO_BATTLE_OPTION_LABELS},
  {slug:'murlanroyale',name:'Murlan Royale',shortName:'Murlan',symbol:'♠',items:MURLAN_ROYALE_STORE_ITEMS,labels:MURLAN_ROYALE_OPTION_LABELS},
  {slug:'weaponkart',name:'Weapon Kart',shortName:'Kart',symbol:'◒',items:MURLAN_ROYALE_STORE_ITEMS.filter(item=>item.type==='characters').map(item=>({...item,type:'humanCharacter'})),labels:{humanCharacter:MURLAN_ROYALE_OPTION_LABELS.characters}},
  {slug:'domino-royal',name:'Domino Royal',shortName:'Domino',symbol:'⚄',items:DOMINO_ROYAL_STORE_ITEMS,labels:DOMINO_ROYAL_OPTION_LABELS},
  {slug:'snake',name:'Snake & Ladder',shortName:'Snake',symbol:'〰',items:SNAKE_STORE_ITEMS,labels:SNAKE_OPTION_LABELS},
  {slug:'texasholdem',name:"Texas Hold'em",shortName:'Poker',symbol:'♣',items:TEXAS_HOLDEM_STORE_ITEMS,labels:TEXAS_HOLDEM_OPTION_LABELS}
];
const prices = STORE_GAMES.flatMap(game=>game.items.map(item=>item.price)).filter(Number.isFinite);
const priceMin=prices.length?Math.min(...prices):0, priceMax=prices.length?Math.max(...prices):0;
export const STORE_ITEMS: StoreItem[] = STORE_GAMES.flatMap(game=>game.items.map(item=>{
  const info=itemInfo(item);
  return {...item,slug:game.slug,gameName:game.name,displayLabel:game.labels[item.type]?.[item.optionId]||item.name,
    typeLabel:info.label,category:info.category,sourcePrice:item.price,price:legacyStorePrice(item.price,priceMin,priceMax),
    key:`${game.slug}:${item.id}`,entitlementKey:entitlementKey({...item,slug:game.slug})};
}));
