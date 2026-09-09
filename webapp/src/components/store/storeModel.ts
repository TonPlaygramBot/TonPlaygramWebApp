export interface CatalogItem {
  id: string; type: string; optionId: string | number; name: string; price: number;
  description?: string; thumbnail?: string | { url?: string; src?: string };
  image?: string; imageUrl?: string; previewImage?: string; zoomImage?: string;
  swatches?: Array<string | number>; previewShape?: string;
  media?: { image?: string; thumbnail?: string }; preview?: { image?: string; thumbnail?: string };
}
export interface StoreItem extends CatalogItem {
  slug: string; gameName: string; displayLabel: string; category: string;
  typeLabel: string; key: string; entitlementKey: string; sourcePrice: number;
}
export type ArtworkKind = 'cue'|'table'|'cloth'|'base'|'rail'|'pocket'|'marker'|'chair'|'board'|'chess'|'token'|'domino'|'dice'|'cards'|'puck'|'mallet'|'snake'|'environment'|'theme'|'character'|'outfit'|'training'|'material';
export const TYPE_INFO: Record<string, [string, string, ArtworkKind, string]> = {
  tableFinish: ['Table finish','Tables','table','Changes the finish of the table frame and rails.'],
  tableWood: ['Table wood','Tables','table','Changes the wood finish on the table.'],
  table: ['Table finish','Tables','table','Changes the table finish.'],
  tables: ['Table model','Tables','table','Changes the table model.'],
  tableTheme: ['Table model','Tables','table','Changes the table model or theme.'],
  tableShape: ['Table shape','Tables','table','Changes the shape of the table.'],
  tableBase: ['Table base','Tables','base','Changes the supports beneath the tabletop.'],
  clothColor: ['Table cloth','Tables','cloth','Changes the color of the playing cloth.'],
  tableCloth: ['Table cloth','Tables','cloth','Changes the table cloth.'],
  cushionCloth: ['Cushion cloth','Tables','cloth','Changes the cloth on the cushions.'],
  cueStyle: ['Cue style','Cues','cue','Changes the appearance of your cue.'],
  chromeColor: ['Chrome fascia','Details','rail','Changes the finish of the metal fascia.'],
  chromePlateStyle: ['Chrome plates','Details','rail','Changes the style of the chrome plates.'],
  railMarkerColor: ['Rail markers','Details','marker','Changes the color of the diamond markers on the rails.'],
  pocketLiner: ['Pocket jaws','Details','pocket','Changes the finish of the pocket jaws.'],
  chairColor: ['Chair finish','Seating','chair','Changes the color of the chairs.'],
  chairTheme: ['Chair style','Seating','chair','Changes the chair style.'],
  stools: ['Seating','Seating','chair','Changes the seating around your table.'],
  boardTheme: ['Board theme','Boards','board','Changes the appearance of the board.'],
  boardFinish: ['Board finish','Boards','board','Changes the board finish.'],
  frameFinish: ['Board frame','Boards','board','Changes the frame around the board.'],
  boardLayout: ['Board layout','Boards','board','Changes the board layout.'],
  boardPalette: ['Board palette','Boards','board','Changes the color palette of the board.'],
  triangleColor: ['Triangle colors','Boards','board','Changes the colors of the board triangles.'],
  sideColor: ['Piece colors','Pieces','chess','Changes the colors of the playing pieces.'],
  headStyle: ['Pawn heads','Pieces','chess','Changes the shape of the pawn heads.'],
  stoneStyle: ['Stone set','Pieces','token','Changes the appearance of the playing stones.'],
  tokenPalette: ['Token palette','Pieces','token','Changes the token color palette.'],
  tokenStyle: ['Token style','Pieces','token','Changes the appearance of the tokens.'],
  tokenPiece: ['Token piece','Pieces','token','Changes the token piece.'],
  tokenFinish: ['Token finish','Pieces','token','Changes the finish of the tokens.'],
  tokenColor: ['Token colors','Pieces','token','Changes the colors of the tokens.'],
  tokenShape: ['Token shape','Pieces','token','Changes the shape of the tokens.'],
  dominoStyle: ['Domino colors','Pieces','domino','Changes the colors of the domino tiles.'],
  dominoDotStyle: ['Domino dots','Pieces','domino','Changes the dots on the domino tiles.'],
  dominoFrameStyle: ['Domino frames','Pieces','domino','Changes the frames around the domino tiles.'],
  diceTheme: ['Dice finish','Pieces','dice','Changes the finish of the dice.'],
  cards: ['Card theme','Cards','cards','Changes the appearance of the playing cards.'],
  field: ['Rink surface','Rink','board','Changes the playing surface of the rink.'],
  puck: ['Puck finish','Rink','puck','Changes the finish of the puck.'],
  mallet: ['Mallet style','Rink','mallet','Changes the appearance of the mallets.'],
  rails: ['Rink rails','Rink','rail','Changes the rink rails.'],
  goals: ['Goals','Rink','rail','Changes the appearance of the goals.'],
  railTheme: ['Rails & nets','Details','rail','Changes the board rails and nets.'],
  highlightStyle: ['Highlights','Details','marker','Changes the highlight effect.'],
  snakeSkin: ['Snake skin','Pieces','snake','Changes the appearance of the snake.'],
  environmentHdri: ['Environment','Environments','environment','Changes the scene environment and lighting.'],
  arenaTheme: ['Arena atmosphere','Environments','environment','Changes the atmosphere of the arena.'],
  appTheme: ['Home theme','Themes','theme','Changes the appearance of the app home screen.'],
  humanCharacter: ['Character','Characters','character','Changes the character model.'],
  characters: ['Character','Characters','character','Changes the character model.'],
  outfit: ['Outfit','Characters','outfit','Changes the character outfit.'],
  poolTrainingAttempt: ['Training attempts','Training','training','Adds training attempts to your Pool Royale attempt bank.'],
  floorFinish: ['Floor finish','Details','cloth','Changes the floor finish.']
};
export const humanize = (s: string) => s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
export function itemInfo(item: Pick<CatalogItem,'type'>) {
  const [label, category, kind, effect] = TYPE_INFO[item.type] || [humanize(item.type),'Accessories','material','Updates this item option.'];
  return { label, category, kind: kind as ArtworkKind, effect };
}
export function entitlementKey(item: Pick<StoreItem,'slug'|'type'|'optionId'>): string {
  const family = ({bilardoshqip:'poolroyale', checkersbattleroyal:'chessbattleroyal', weaponkart:'murlanroyale'} as Record<string,string>)[item.slug] || item.slug;
  const type = item.slug === 'weaponkart' && item.type === 'humanCharacter' ? 'characters' : item.type;
  return `${family}:${type}:${item.optionId}`;
}
/** Preserve the existing Store.jsx price transform. A UI redesign must not reprice the catalog. */
export function legacyStorePrice(raw: number, min: number, max: number): number {
  if (!Number.isFinite(raw)) return 100;
  if (max <= min) return 5000;
  return Number((100 + Math.min(1,Math.max(0,(raw-min)/(max-min))) * 4900).toFixed(2));
}
export const money = (value: number): string => new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const ITEM_COPY: Record<string,string> = {
  'cueStyle:redwood-ember': 'Rich redwood tones with warm ember accents.',
  'cueStyle:carbon-matrix': 'A carbon-fiber look with metallic weave highlights.',
  'cueStyle:maple-horizon': 'Bright maple tones with distinctive horizon banding.',
  'cueStyle:graphite-aurora': 'Graphite weave with an aurora-inspired tint.',
  'cueStyle:wenge-nightfall': 'Deep wenge tones with high-contrast stripes.',
  'cueStyle:mahogany-heritage': 'Classic mahogany tones with highlighted wood grain.',
  'cueStyle:walnut-satin': 'A satin walnut finish with balanced contrast.',
  'pocketLiner:plastic-magnolia': 'Warm magnolia pocket jaws with a soft, molded look.',
  'pocketLiner:plastic-black': 'Matte black pocket jaws with a subtle molded sheen.',
  'tableBase:openPortal': 'Twin portal supports with angled sides and open space.',
  'tableBase:classicCylinders': 'A rounded skirt with six cylinder legs and subtle foot pads.',
  'tableFinish:oakVeneer01': 'Warm oak veneer rails with a smooth satin finish.',
  'tableFinish:rosewoodVeneer01': 'Rich rosewood rails with reddish undertones.',
  'environmentHdri:neonPhotostudio': 'A vibrant studio environment with strong rim lighting.'
};
export function itemDescription(item: Pick<StoreItem,'type'|'optionId'|'description'|'gameName'|'displayLabel'>) {
  if (item.type === 'poolTrainingAttempt') {
    const n = Number(item.optionId);
    return {short: `Add ${Number.isFinite(n) ? n : 'extra'} training attempt${n === 1 ? '' : 's'} to your bank.`,
      full: `Adds ${Number.isFinite(n) ? n : 'extra'} Pool Royale training attempt${n === 1 ? '' : 's'}. This is a consumable, not a visual customization.`, effect: 'Training attempt bank', note:'Consumable'};
  }
  const info = itemInfo(item);
  const specific = ITEM_COPY[`${item.type}:${item.optionId}`] || String(item.description || '').trim().replace(/\s+/g,' ');
  // Preserve catalog facts; never invent rarity, supply, ownership history, material quality or gameplay benefits.
  return {short: specific || info.effect,
    full: `${specific ? specific.replace(/[.!?]$/, '') + '. ' : ''}${info.effect.replace(/\.$/, '')} in ${item.gameName}.`,
    effect: info.effect, note:'In-game customization'};
}
export interface StoreFilters { game: string; category: string; query: string; sort: string; ownedOnly?: boolean; hideOwned?: boolean }
export function filterItems(items: StoreItem[], filters: StoreFilters, isOwned: (item: StoreItem)=>boolean): StoreItem[] {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    if(filters.game !== 'all' && item.slug !== filters.game) return false;
    if(filters.category !== 'All' && item.category !== filters.category) return false;
    if(filters.ownedOnly && !isOwned(item)) return false;
    if(filters.hideOwned && isOwned(item)) return false;
    const haystack = `${item.displayLabel} ${item.name} ${item.gameName} ${item.typeLabel} ${item.description || ''}`.toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  }).sort((a,b) => filters.sort === 'price-low' ? a.price-b.price || a.key.localeCompare(b.key) : filters.sort === 'price-high' ? b.price-a.price || a.key.localeCompare(b.key) : filters.sort === 'name' ? a.displayLabel.localeCompare(b.displayLabel) : 0);
}
export function uniqueCart(items: StoreItem[]): StoreItem[] {
  return [...new Map(items.map(item => [item.entitlementKey,item])).values()];
}
export function totalPrice(items: Pick<StoreItem,'price'>[]): number {
  return items.reduce((n,item)=>n+Math.round(item.price*100),0)/100;
}
