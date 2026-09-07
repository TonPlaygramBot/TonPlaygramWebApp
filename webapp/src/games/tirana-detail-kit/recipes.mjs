/** Original editable urban-detail assets, in metres. These are Tirana-inspired
 * modules, not scans or claims that every rooftop appliance is surveyed. */
export const PALETTE = Object.freeze({
  metal:{color:0x717b78,roughness:.53,metalness:.65}, dark:{color:0x293637,roughness:.73,metalness:.15},
  pale:{color:0xd8d2bd,roughness:.87,metalness:0}, glass:{color:0x315b64,roughness:.29,metalness:.5},
  terracotta:{color:0xa96b50,roughness:.88,metalness:0}, blue:{color:0x457c89,roughness:.76,metalness:0},
  wood:{color:0x87704e,roughness:.92,metalness:0}
});
const box=(m,s,p,r=[0,0,0])=>({kind:'box',m,s,p,r});
const cylinder=(m,radius,height,p,r=[0,0,0],top=radius)=>({kind:'cylinder',m,radius,top,height,p,r,segments:12});
const ac=()=>[
  box('pale',[1.05,.72,.48],[0,.4,0]),box('dark',[.02,.56,.36],[-.535,.4,0]),
  cylinder('dark',.23,.025,[.21,.41,.25],[Math.PI/2,0,0]),
  ...Array.from({length:7},(_,i)=>box('metal',[.42,.025,.035],[-.25,.18+i*.065,.255])),
  ...[-.4,.4].map(x=>box('metal',[.12,.1,.65],[x,.05,0]))
];
export const RECIPES = Object.freeze({
  'rooftop-ac':{category:'roof',parts:ac()},
  'water-tank':{category:'roof',parts:[cylinder('blue',.62,1.55,[0,.9,0]),cylinder('metal',.66,.08,[0,1.71,0]),cylinder('metal',.13,.1,[0,1.8,0]),box('metal',[1.5,.16,1.5],[0,.08,0]),cylinder('metal',.045,1.5,[.65,.75,0])]},
  'solar-heater':{category:'roof',parts:[box('metal',[2.2,.16,1.75],[0,.08,0]),box('glass',[2.05,.08,1.55],[0,.52,.05],[.42,0,0]),cylinder('pale',.25,1.9,[0,1.02,-.6],[0,0,Math.PI/2]),...[-.9,.9].map(x=>box('metal',[.08,.9,.08],[x,.45,-.65]))]},
  'vent-bank':{category:'roof',parts:[box('metal',[1.4,.6,.85],[0,.3,0]),...[-.42,.42].flatMap(x=>[cylinder('dark',.18,.8,[x,.85,0]),cylinder('metal',.26,.1,[x,1.3,0])])]},
  'roof-hatch':{category:'roof',parts:[box('pale',[1.6,1.8,1.7],[0,.9,0]),box('dark',[.85,1.55,.06],[0,.82,.88]),box('metal',[1.8,.14,1.9],[0,1.87,0]),box('metal',[.05,.3,.05],[.27,.85,.94])]},
  'vent-stack':{category:'roof',parts:[box('pale',[.7,1.15,.7],[0,.575,0]),box('metal',[.94,.14,.94],[0,1.22,0]),...[-.28,.28].map(x=>box('dark',[.12,.4,.76],[x,.8,0]))]},
  'window-frame':{category:'facade',parts:[box('glass',[1.55,1.65,.055],[0,.85,0]),...[-.82,.82].map(x=>box('pale',[.1,1.88,.13],[x,.85,.03])),...[-.04,1.74].map(y=>box('pale',[1.75,.1,.13],[0,y,.03])),box('metal',[.07,1.68,.12],[0,.85,.04]),box('pale',[1.95,.15,.4],[0,-.15,.12])]},
  'balcony':{category:'facade',parts:[box('pale',[2.8,.2,1.2],[0,0,.6]),box('metal',[2.8,.06,.06],[0,1.05,1.17]),...[-1.36,1.36].map(x=>box('metal',[.06,.06,1.2],[x,1.05,.6])),...Array.from({length:10},(_,i)=>box('metal',[.035,1.04,.035],[-1.34+i*.298,.53,1.17])),...[-1.36,1.36].flatMap(x=>[.15,.5,.85].map(z=>box('metal',[.035,1.04,.035],[x,.53,z])))]},
  'shop-awning':{category:'facade',parts:[box('terracotta',[3.4,.12,1.5],[0,2.65,.72],[.14,0,0]),box('terracotta',[3.4,.28,.06],[0,2.39,1.46]),...[-1.5,1.5].map(x=>box('metal',[.045,1.25,.045],[x,2.1,.73],[.6,0,0]))]},
  'shutter':{category:'facade',parts:[box('dark',[2.6,2.75,.08],[0,1.4,0]),...Array.from({length:17},(_,i)=>box('metal',[2.48,.1,.075],[0,.13+i*.156,.07])),box('pale',[2.9,.16,.2],[0,2.82,0])]},
  'downpipe':{category:'facade',parts:[cylinder('metal',.055,3.1,[0,1.55,.12]),... [.2,1.55,2.9].map(y=>box('dark',[.18,.055,.26],[0,y,.08]))]},
  'door-frame':{category:'facade',parts:[box('dark',[1.24,2.35,.09],[0,1.2,0]),box('glass',[.97,1.35,.025],[0,1.47,.06]),...[-.68,.68].map(x=>box('pale',[.1,2.55,.14],[x,1.22,.03])),box('pale',[1.45,.12,.14],[0,2.53,.03]),box('metal',[.055,.34,.06],[.39,1.13,.12])]},
  'park-bench':{category:'park',parts:[...[-.2,0,.2].map(z=>box('wood',[1.85,.055,.17],[0,.49,z])),... [.72,.9].map(y=>box('wood',[1.85,.12,.055],[0,y,-.25])),...[-.65,.65].flatMap(x=>[box('metal',[.065,.46,.065],[x,.23,0]),box('metal',[.065,.5,.065],[x,.73,-.25])])]},
  'cycle-rack':{category:'park',parts:[...[-.72,0,.72].flatMap(x=>[cylinder('metal',.04,.8,[x-.23,.4,0]),cylinder('metal',.04,.8,[x+.23,.4,0]),cylinder('metal',.04,.46,[x,.8,0],[0,0,Math.PI/2])])]},
  'park-lamp':{category:'park',parts:[cylinder('dark',.09,4.2,[0,2.1,0]),box('metal',[.8,.12,.4],[.27,4.2,0]),box('pale',[.64,.04,.33],[.27,4.12,0])]},
  'bollard':{category:'park',parts:[cylinder('dark',.105,.85,[0,.425,0]),cylinder('pale',.108,.07,[0,.73,0]),cylinder('metal',.16,.07,[0,.035,0])]}
});
export const ASSET_IDS=Object.freeze(Object.keys(RECIPES));
