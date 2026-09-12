import {BUSINESS_BUILDING_PROFILES,BUSINESS_OBSERVED_HEIGHTS} from './businessBuildingProfiles.mjs';
import {CITY_BUSINESS_BUILDING_PROFILES,CITY_BUSINESS_OBSERVED_HEIGHTS} from './cityBusinessProfiles.mjs';
/** Source-frame interpretations from inspected exteriors. No source photo is
 * used as a texture. Metric heights/bay spacing remain estimates where noted. */
const school={site:'education-reference',category:'school',flagCountry:'AL',floor:3.2,window:1.5,photo:null,credit:'Reference only; source imagery not redistributed'};
const book={site:'book-building',category:'mixed-use',floor:3.6,window:2.4,photo:null,color:0xd6d3c7,trim:0xe9e5d8,source:'https://51n4e.com/projects/book-building/',date:'2020 project; inspected 2026-09-12',credit:'51N4E project reference only',features:'Arched facade bays and pale balcony parapets based on the published project. Existing mapped volumes retained; not an as-built survey.',status:'project-informed; OSM site still tagged construction in July 2026',permitSource:'https://azht.gov.al/wp-content/uploads/2025/05/HARTA-E-PLANVENDOSJES-VENDIM-NR-26-DATE-20.11.2024.pdf'};
export const NEIGHBOURHOOD_REFERENCE_PROFILES={
 ...BUSINESS_BUILDING_PROFILES,
 ...CITY_BUSINESS_BUILDING_PROFILES,
 'relation/14761294':{...school,name:'Gjimnazi Sami Frashëri',style:'sami-frasheri',color:0x969581,trim:0xb2af92,source:'https://tirana.al/artikull/gjimnazi-sami-frasheri-eshte-gati-veliaj-eshte-shkolla-e-se-ardhmes-basti-i-atyre-qe-bllokojne-punet-dhe-jane-kunder-progresit-eshte-i-humbur',date:'2023-12 Google Maps photo, Ermal Rama; city reconstruction report 2022',features:'Olive vertical wave fins, dark full-height glazing and pale roof edge. Existing four-level estimate and courtyard retained.'},
 '731114346':{...school,name:'Shkolla Servete Maçi',style:'servete-maci',color:0xc9c8bf,trim:0xe3e1d7,height:10.8,source:'https://studioarch4.com/portfolio_page/servete-maci-school/',date:'Architect gallery inspected 2026-09-12; capture undated',features:'Exposed pale concrete, turquoise and coral ground-floor volumes, tall narrow upper windows and open U-shaped courtyard. Three visible levels; 10.8 m visual estimate replaces one-storey placeholder.'},
 '885643064':{...book,name:'Book Building · kulla',style:'book-arches'},
 '885643065':{...book,name:'Book Building · godina pranë Kullës së Sahatit',style:'book-arches'},
 '885643063':{...book,name:'Book Building · podiumi',style:'book-wing'}
};
export const OBSERVED_HEIGHTS={...BUSINESS_OBSERVED_HEIGHTS,...CITY_BUSINESS_OBSERVED_HEIGHTS,'731114346':{height:10.8,basis:'Three levels visible in Studioarch4 exterior; 3.6 m per level estimated, not surveyed',source:'https://studioarch4.com/portfolio_page/servete-maci-school/'}};
