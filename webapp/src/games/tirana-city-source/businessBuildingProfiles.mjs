/** Exterior interpretations inspected 2026-09-12. Bay spacing, hidden elevations
 * and unmeasured heights are estimates. Reference photos are not redistributed. */
const hotel={site:'business-reference',category:'hotel',floor:3.2,window:1.6,photo:null,date:'Inspected 2026-09-12; photograph capture date unknown',credit:'Visual reference only; original geometry, no source photo redistributed'};
const xhekoSource='https://www.expedia.com/Tirana-Hotels-Xheko-Hotel-Tirana.h2813077.Hotel-Information';
export const BUSINESS_BUILDING_PROFILES={
 '196893237':{...hotel,name:'Hotel Mondial',style:'mondial',color:0xb6ae99,trim:0xeee8d8,height:19.2,front:[-.37245,-.92805],source:'https://www.hotelmondial.al/',referenceImage:'https://www.hotelmondial.al/images/slider/slide1_bg.jpg',features:'Six-level estimate; pale classical bands, arched balcony openings and rooftop terrace. Replaces a one-level placeholder.'},
 '382410981':{...hotel,name:'MonarC Boutique Hotel',style:'monarc',color:0xd8c8ac,trim:0xf0e8d5,front:[-.9613,.27551],source:'https://www.monarc.al/',referenceImage:'https://cdn.travoo.com/0000/1/2026/07/18/monarc-front.jpg',features:'Cream corner block, rusticated stone base, red-brown shutters, cornices and rooftop pergola. Mapped outline and height retained.'},
 '400645195':{...hotel,category:'bank',name:'Credins Bank - Headquarter',style:'credins-hq',color:0x4f9694,trim:0xaec7c2,front:[.20162,.97946],source:'https://www.bankacredins.com/',referenceImage:'https://cdn.prod.website-files.com/68ba9d4638dc9ab5e8fe44a1/68be87dacc91fe7bebc4c836_credins-headquarters.jpg',features:'Turquoise sides with narrow staggered openings; glazed curtain front and upper screen. Existing height estimate retained.'},
 '56015564':{...hotel,name:'Hotel Dinasty',style:'dinasty',color:0xc4a789,trim:0xede3cf,front:[-.23105,-.97294],source:'https://dinastyhotel.al/en/',referenceImage:'https://dinastyhotel.al/images/banners/1-Dinasty-Hotel.jpg',features:'Stacked pale balcony slabs, dark rails, red-brown columns and timber canopy. Irregular footprint and mapped height retained.'},
 '400647876':{...hotel,name:'Xheko Imperial Luxury Hotel & Spa',style:'xheko-podium',color:0x75614e,trim:0xeee5d3,height:19.2,front:[.97564,-.21936],source:xhekoSource,referenceImage:'https://images.trvl-media.com/lodging/3000000/2820000/2813100/2813077/b92cf3ad.jpg',features:'Lower podium, paired arches, pale pilasters and rooftop terrace. Separate estimated rear tower; neither volume is surveyed.'},
 'visual-part/400647876/tower':{...hotel,category:'hotel-part',name:'Xheko Imperial · rear tower',style:'xheko-tower',color:0xb7a38b,trim:0xf0e8d7,height:44.8,front:[.97564,-.21936],source:xhekoSource,referenceImage:'https://images.trvl-media.com/lodging/3000000/2820000/2813100/2813077/b92cf3ad.jpg',features:'Authored rear tower inside mapped hotel outline. Stacked pale bays and tall upper arches. Position and fourteen-level height estimated.'},
 '357208310':{...hotel,name:'Hotel Gloria',style:'gloria',color:0x965e48,trim:0xf0e4d2,front:[-.3992,-.91687],source:'https://www.agoda.com/en-sg/hotel-boutique-restaurant-gloria/hotel/tirana-al.html',referenceImage:'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/68018854.jpg?k=c8529994db54e801cdf7b06f462ba842e8c7dc770bef243188e565b700398154&o=',features:'Red-brick lower floors, white pilasters, projecting glazed bay and glazed rooftop restaurant. Existing height estimate retained.'},
 '405907464':{...hotel,name:'Hotel Senator',style:'senator',color:0xc1a675,trim:0xf0e7d5,front:[-.44645,-.89481],source:'https://www.momondo.in/hotels/tirana/Senator-Hotel.mhd2597813.ksp',referenceImage:'https://www.momondo.in/himg/07/dc/9a/expedia_group-2597813-4e2f1e-753012.jpg',features:'Ochre walls, white cornices and pilasters, narrow windows and restrained side elevation. Five-level height retained.'},
 '295491009':{...hotel,name:'Hotel Elysee',style:'elysee',color:0xd0c4ae,trim:0xebe6d8,front:[.27623,.96109],source:'https://hotelelysee.al/',referenceImage:'https://hotelelysee.al/wp-content/uploads/2020/09/IMG_9867.png',features:'Stone base, pale upper walls, white balcony rails and vertical glazed bay. Courtyard reference; hidden elevations estimated.'}
};
export const BUSINESS_OBSERVED_HEIGHTS={
 '196893237':{height:19.2,basis:'Six levels at an estimated 3.2 m; official exterior and sixth-floor pool description, not surveyed',source:'https://www.hotelmondial.al/'},
 '400647876':{height:19.2,basis:'Podium estimated at 19.2 m; rear tower represented separately, not surveyed',source:xhekoSource}
};
/** Authored part, never assigned a fabricated OSM ID. Intersected with the
 * existing parent outline; it introduces no new ground obstruction. */
export const BUSINESS_BUILDING_PARTS=[{
 id:'visual-part/400647876/tower',parentBuildingId:'400647876',name:'Xheko Imperial · rear tower',h:44.8,
 p:[[-36,1038.5143564356435],[-27.09,1036.75],[-28.033158436213988,1032],[-17,1032],[-17,1059],[-35.265405860559106,1059],[-36,1055.303372881356]],
 heightBasis:'Fourteen levels at 3.2 m estimated from exterior; authored part inside mapped parent, not an OSM part or surveyed geometry',visualHeightSource:xhekoSource
}];
