/** Urban combat jobs now live in the same city, inventory and save as the story.
 * Coordinates describe gameplay staging, not real security arrangements. */
export const STREET_OPERATIONS = Object.freeze([
  {id:'operation-square',map:'skanderbeg',title:'Square signal',district:'QENDËR',x:-60.62,z:-222.83,extractX:-99.7,extractZ:75.53,enemies:4,time:480,reward:500,hold:4,description:'Approach the square, stop the armed crew, recover their equipment and extract by the western street.'},
  {id:'operation-blloku',map:'blloku',title:'Blloku blackout',district:'BLLOKU',x:-194.54,z:822.70,extractX:-262.46,extractZ:887.09,enemies:6,time:540,reward:700,hold:5,description:'Clear the armed roadblock between the Blloku buildings. Reach the pickup point with your recovered gear.'},
  {id:'operation-lana',map:'lana',title:'River corridor',district:'LANA',x:85.38,z:678.17,extractX:161.03,extractZ:697.65,enemies:6,time:540,reward:750,hold:6,description:'Fight through the riverfront approach, collect dropped ammunition and hold the extraction point.'},
  {id:'operation-bazaar',map:'bazaar',title:'Bazaar recovery',district:'PAZARI I RI',x:510.73,z:-317.17,extractX:479.91,extractZ:-180.97,enemies:5,time:480,reward:650,hold:4,description:'Locate the armed crew near the market and secure a route out. Protect bystanders while crossing the district.'},
  {id:'operation-stadium',map:'stadium',title:'Stadium perimeter',district:'AIR ALBANIA',x:508.9,z:1015.82,extractX:409.78,extractZ:1137.99,enemies:8,time:600,reward:900,hold:7,description:'Break the hostile perimeter, gather equipment and hold the southern pickup until extraction is ready.'},
  {id:'operation-ali-demi',map:'district-6298022012',title:'Ali Demi stand',district:'ALI DEMI',x:1688.02,z:-17.12,extractX:1613.26,extractZ:73.99,enemies:8,time:900,reward:1000,hold:8,description:'Drive across the city to Ali Demi, clear the armed group and withdraw through the neighborhood.'}
].map(Object.freeze));
export const OPERATION_IDS = Object.freeze(STREET_OPERATIONS.map(o=>o.id));
