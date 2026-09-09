/** Canonical gift definitions shared by the server and web app.
 * IDs/prices of the original fourteen gifts are intentionally unchanged.
 * Tiers describe the design collection, NOT on-chain scarcity or supply.
 * Icons remain plain fallback symbols for receipts/notifications; the web UI
 * renders original artwork using model + palette, never platform emoji art.
 */
export const GIFT_TIER_LABELS = Object.freeze({ 1: 'Classic', 2: 'Signature', 3: 'Prestige' });
export const GIFT_COLLECTIONS = Object.freeze(['Originals', 'Royal', 'Cosmos', 'Companions', 'Sweet Shop', 'Arcade', 'Botanical', 'Treasury', 'Mythic']);
const originals = [
  ['fireworks','Fireworks','🎆',200,1,'firework','#aa85ff','#ffd782','Simple visual burst'],
  ['laugh_bomb','Laugh Bomb','😂',300,1,'bomb','#ffd16e','#fe8aaa',"Makes others’ screen shake briefly"],
  ['pizza_slice','Pizza Slice','🍕',500,1,'pizza','#ffcc79','#f97070','Shows pizza fly across screen'],
  ['coffee_boost','Coffee Boost','☕',750,1,'coffee','#dbc2a5','#8ed9cb','Funny energy-up animation'],
  ['baby_chick','Baby Chick','🐣',1000,1,'chick','#ffe49b','#f8a6c7','Cute chick dances on screen'],
  ['poop','Poop','💩',1200,2,'poop','#bd8968','#ffe6b0','Smelly surprise'],
  ['speed_racer','Speed Racer','/assets/icons/futuristic_racing_car.webp',1800,2,'car','#74dbdc','#c4b0ff','Car zooms across the game board'],
  ['bullseye','Bullseye','🎯',3000,2,'target','#ff8599','#f7edcc',"Dart hits target on player’s profile"],
  ['magic_trick','Magic Trick','🎩',5000,2,'hat','#b69aff','#ffd780','Random gift animation'],
  ['surprise_box','Surprise Box','🎁',8000,2,'gift','#cc9aff','#ffd996','Opens to show an emoji effect'],
  ['dragon_burst','Dragon Burst','🐉',20000,3,'dragon','#9dddd0','#ffdc83','Dragon flies across the board'],
  ['rocket_blast','Rocket Blast','🚀',35000,3,'rocket','#e4e8f4','#ffb496','Rocket launches with a flame trail'],
  ['royal_crown','Royal Crown','👑',90000,3,'crown','#ffe29b','#bca1ff',"Crown lands on the recipient’s avatar"],
  ['alien_visit','Alien Visit','🛸',150000,3,'ufo','#acd7f5','#e4a6ff','UFO beam animation']
];
// Each row is a deliberately named design, not an automatically multiplied rarity variant.
// [id, name, receipt icon, price in TPG, model, primary, accent]
const collections = {
  Royal: [
    ['velvet_coronet','Velvet Coronet','♛',12000,'crown','#e5a8bb','#ffda8e'],
    ['imperial_scepter','Imperial Scepter','⚜',16000,'wand','#ffe19d','#ba9ae8'],
    ['sovereign_seal','Sovereign Seal','🔱',9500,'medal','#f5ce81','#98c9e3'],
    ['palace_key','Palace Key','🗝',6000,'key','#f2d293','#c6b0e9'],
    ['sapphire_throne','Sapphire Throne','🪑',24000,'throne','#88afe9','#e8d49d'],
    ['victory_chalice','Victory Chalice','🏆',10000,'trophy','#f9de9e','#a1dacc'],
    ['royal_signet','Royal Signet','💍',18000,'ring','#eecb8f','#dd97b7'],
    ['knights_oath','Knight’s Oath','🛡',14000,'shield','#adbee1','#ffe1a3'],
    ['diamond_court','Diamond Court','♦',32000,'gem','#c4e1fa','#b9a5f4']
  ],
  Cosmos: [
    ['saturn_silk','Saturn Silk','🪐',4500,'planet','#e8c49a','#ccb7ff'],
    ['moon_drop','Moon Drop','🌙',2800,'moon','#eee5c7','#b7c9fa'],
    ['nova_star','Nova Star','🌟',3500,'star','#ffe5a1','#ffb9ca'],
    ['comet_courier','Comet Courier','☄',6500,'comet','#c0ceff','#fba8bd'],
    ['orbital_probe','Orbital Probe','🛰',8500,'satellite','#bed9e9','#e9b771'],
    ['cosmic_capsule','Cosmic Capsule','🧑‍🚀',11000,'rocket','#afc1f2','#e1b1ee'],
    ['galaxy_pearl','Galaxy Pearl','🌌',15000,'orb','#afa2e9','#a2e9d2'],
    ['solar_flare','Solar Flare','☀',7000,'sun','#ffbf86','#ffe9b4'],
    ['meteor_heart','Meteor Heart','💫',9000,'heart','#c2a4ef','#98dfe1']
  ],
  Companions: [
    ['pocket_bear','Pocket Bear','🧸',800,'bear','#d6b296','#f6d9c5'],
    ['cloud_bunny','Cloud Bunny','🐰',1000,'bunny','#e9ddf0','#f1b0ca'],
    ['lucky_fox','Lucky Fox','🦊',2200,'fox','#f2bc89','#fff0d4'],
    ['midnight_cat','Midnight Cat','🐈‍⬛',3200,'cat','#a8a3d2','#ffe1a3'],
    ['panda_hug','Panda Hug','🐼',2500,'panda','#e5e4ed','#9998bf'],
    ['pearl_penguin','Pearl Penguin','🐧',1800,'penguin','#a8c4db','#ffe0a4'],
    ['tiny_frog','Tiny Frog','🐸',750,'frog','#a1d7b3','#e4ecb7'],
    ['velvet_owl','Velvet Owl','🦉',4200,'owl','#bda3da','#e8d2b2'],
    ['aurora_whale','Aurora Whale','🐳',6500,'whale','#95d2dc','#ceaff5']
  ],
  'Sweet Shop': [
    ['berry_shortcake','Berry Shortcake','🍰',900,'cake','#f3afc5','#fff0ce'],
    ['starlight_donut','Starlight Donut','🍩',650,'donut','#d5b1ef','#ffe0a7'],
    ['pistachio_cloud','Pistachio Cloud','🍦',800,'icecream','#bfddb6','#f0c99f'],
    ['macaron_muse','Macaron Muse','🥮',1200,'macaron','#c4b3ee','#fae0bc'],
    ['matcha_moment','Matcha Moment','🍵',550,'coffee','#b7cfa9','#efe3bb'],
    ['cherry_soda','Cherry Soda','🥤',700,'soda','#ed9db9','#f3e2c1'],
    ['honey_jar','Honey Jar','🍯',1600,'jar','#ecc585','#ffe9b6'],
    ['candy_twist','Candy Twist','🍬',400,'candy','#f6b4d7','#bcb7ee'],
    ['chocolate_love','Chocolate Love','🍫',2400,'heart','#bf917f','#f4b9c7']
  ],
  Arcade: [
    ['lucky_dice','Lucky Dice','🎲',1400,'dice','#e9d6af','#a7c0e8'],
    ['eight_ball','Eight Ball','🎱',3000,'eightball','#8d9ba9','#eee5cd'],
    ['grandmaster','Grandmaster','♟',8000,'chess','#c7b7de','#f0ddb1'],
    ['neon_controller','Neon Controller','🎮',5500,'controller','#b7a6ec','#9cdacc'],
    ['pixel_headset','Pixel Headset','🎧',3800,'headphones','#b3c5e2','#e3b4d0'],
    ['turbo_kart','Turbo Kart','🏎',7200,'car','#f5b492','#b9dceb'],
    ['bowling_ace','Bowling Ace','🎳',2800,'bowling','#b0c3ef','#f6d6a5'],
    ['arcade_token','Arcade Token','🪙',500,'medal','#efd093','#c1b9e7'],
    ['champion_cup','Champion Cup','🥇',18000,'trophy','#a9d9cd','#ffe4ac']
  ],
  Botanical: [
    ['eternal_rose','Eternal Rose','🌹',3200,'rose','#eaa2bc','#aacdb0'],
    ['lily_light','Lily Light','🪷',4800,'flower','#d9b8ee','#f3dfb4'],
    ['sunflower_smile','Sunflower Smile','🌻',850,'flower','#f4d98f','#b5cc9a'],
    ['orchid_dream','Orchid Dream','🌺',4200,'flower','#c3ace8','#f5c4d3'],
    ['bonsai_bloom','Bonsai Bloom','🪴',6500,'tree','#a8c9b2','#dec1a4'],
    ['butterfly_kiss','Butterfly Kiss','🦋',2700,'butterfly','#b0b3eb','#f0b9d4'],
    ['clover_charm','Clover Charm','🍀',950,'clover','#a8d8bc','#e7dda7'],
    ['peach_blossom','Peach Blossom','🌸',1800,'flower','#f4c2d2','#e8d3b6'],
    ['crystal_cactus','Crystal Cactus','🌵',3500,'cactus','#a0d3c6','#d3bbec']
  ],
  Treasury: [
    ['ruby_relic','Ruby Relic','♦️',12000,'gem','#e9a0b5','#f4d4a8'],
    ['emerald_echo','Emerald Echo','💚',11000,'gem','#94d2bd','#f0dbab'],
    ['sapphire_secret','Sapphire Secret','💎',14000,'gem','#9ebce9','#cbb8ed'],
    ['pearl_shell','Pearl Shell','🐚',5500,'shell','#edc6cf','#f6ebd5'],
    ['golden_hour','Golden Hour','⌚',9000,'watch','#e8c78e','#b4b4dd'],
    ['perfume_poem','Perfume Poem','🧴',3800,'perfume','#cfb8e7','#edce9e'],
    ['love_letter','Love Letter','💌',650,'letter','#efd5c5','#e9a8c0'],
    ['treasure_chest','Treasure Chest','🧰',19000,'chest','#c89c81','#f0d395'],
    ['music_box','Music Box','🎶',8000,'musicbox','#bcaee6','#edd5a6']
  ],
  Mythic: [
    ['phoenix_feather','Phoenix Feather','🪶',16000,'feather','#edb093','#f5da9d'],
    ['unicorn_wish','Unicorn Wish','🦄',22000,'unicorn','#ded2ef','#f3b9d2'],
    ['dragon_egg','Dragon Egg','🥚',12500,'egg','#a9ccb9','#e5c59b'],
    ['moon_wand','Moon Wand','🪄',7500,'wand','#c1b0e8','#f2e3b9'],
    ['enchanted_blade','Enchanted Blade','🗡',15000,'sword','#b6cee8','#eed29b'],
    ['fairy_lantern','Fairy Lantern','🏮',8500,'lantern','#efc890','#c9b1e8'],
    ['crystal_potion','Crystal Potion','⚗',6800,'potion','#a7d7d2','#dfb5e7'],
    ['celestial_guardian','Celestial Guardian','🐲',28000,'dragon','#b5b5e8','#f4ddab'],
    ['infinity_knot','Infinity Knot','♾',35000,'infinity','#d5b9e9','#f6dfab']
  ]
};
export const NFT_GIFTS = Object.freeze([
  ...originals.map(([id,name,icon,price,tier,model,color,accent,effect]) => Object.freeze({ id,name,icon,price,tier,model,color,accent,effect,collection:'Originals',isNew:false })),
  ...Object.entries(collections).flatMap(([collection, rows]) => rows.map(([id,name,icon,price,model,color,accent]) => Object.freeze({id,name,icon,price,model,color,accent,collection,tier:price<=1000?1:price<=8000?2:3,isNew:true,effect:'Collectible artwork; game-specific effects are not included.'})))
]);
export const GIFT_BY_ID = Object.freeze(Object.fromEntries(NFT_GIFTS.map(gift => [gift.id, gift])));
export function filterGifts({ search = '', collection = 'All', tier = 'All', sort = 'featured' } = {}) {
  const term = String(search).trim().toLocaleLowerCase();
  const items = NFT_GIFTS.filter(g => (collection === 'All' || g.collection === collection) && (tier === 'All' || g.tier === Number(tier)) && (!term || `${g.name} ${g.collection} ${GIFT_TIER_LABELS[g.tier]}`.toLocaleLowerCase().includes(term)));
  return [...items].sort((a,b) => sort === 'price-asc' ? a.price-b.price || a.name.localeCompare(b.name) : sort === 'price-desc' ? b.price-a.price || a.name.localeCompare(b.name) : sort === 'name' ? a.name.localeCompare(b.name) : Number(b.isNew)-Number(a.isNew));
}
export default NFT_GIFTS;
