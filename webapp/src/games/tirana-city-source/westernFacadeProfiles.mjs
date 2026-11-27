/** Exterior reading, never a height source for collision or a redistribution of photos. */
const credit='Reference only; no source imagery redistributed';
const square21=Object.freeze({
 name:'Kompleksi Square 21',style:'western-square-21',site:'square-21',category:'residential',
 color:0xc1b3a1,trim:0xdad4c8,floor:3.2,window:1.8,photo:null,credit,
 source:'https://fab.al/en/square-21/',date:'FAB architect project; XPLAN published in the 2025 awards',
 features:'Mapped 11-level wings with varied light and warm cladding, vertically emphasized green accents and a glazed service base. Not a dimensional survey.'
});
export const WESTERN_FACADE_PROFILES=Object.freeze({
 '659804576':square21,
 '1127816735':square21,
 '712391761':Object.freeze({
  name:'Pallati me Shigjeta',style:'western-arrows',site:'pallati-me-shigjeta',category:'residential',
  color:0x607262,trim:0xa0a19c,floor:3.2,window:1.6,photo:null,credit,
  source:'https://photofromtirana.wordpress.com/2013/10/05/kavaja-street/pallati-me-shigjeta-7/',
  date:'2013-10-05 photo; 2016 reporting corroborates the paint motif',
  features:'Muted green walls, pale painted directional motifs and light bands at recessed balcony stacks. Interpretation of documented finish, not a survey of its present paint.'
 }),
 '1162828946':Object.freeze({
  name:'Marinaj Hotel · Astir',style:'western-marinaj',site:'marinaj-hotel',category:'hotel',
  color:0x9a775e,trim:0xbebcb1,floor:3.3,window:1.8,height:38.4,photo:null,credit,
  source:'https://bigsee.eu/marinaj-hotel/',date:'BIG SEE 2024 architecture award gallery; photo capture undated',
  features:'Pale metallic vertical spine, dark structural glass and warm modular cladding. 38.4 m apparent exterior height is a render estimate; original collision height is unchanged.'
 }),
 '256326439':Object.freeze({
  name:'Kristal Center · Komuna e Parisit',style:'western-kristal',site:'kristal-center',category:'mall',
  color:0xcdbca1,trim:0xe3dfd1,floor:3.2,window:1.6,photo:null,credit,
  source:'https://itegroup.al/wp-content/uploads/2026/04/broshura-ite_-2025.pdf',
  date:'ITE 2025 portfolio p. 19; photo capture undated',
  features:'Cream balcony ribbons, brown brick tones between recessed openings, and a glazed corner podium. Retains the mapped main eight-level volume, not neighbouring annex geometry.'
 }),
});
