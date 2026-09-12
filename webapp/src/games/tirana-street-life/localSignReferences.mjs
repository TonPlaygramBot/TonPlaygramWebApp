/** Operator-published artwork. Matches identify mapped branches only. */
const logo=(id,match,source,background)=>({id,match,logo:`/assets/tirana-streets/signs/${id}-logo.png`,source,background,foreground:'#ffffff',crop:null});
export const LOCAL_SIGN_REFERENCES=[
 logo('gega-oil',/^gega(?: oil)?$/i,'https://gegaoil.al/','#17296d'),
 logo('eida',/^eida(?: petrol)?$/i,'https://europetrolgroup.com/','#ffffff'),
 logo('bolv',/^bolv(?:[- ]oil)?$/i,'https://www.bolv.al/','#ffffff'),
 {keepName:true,...logo('kastrati',/^(?:karburant )?kastrati(?: oil)?$/i,'https://kastrati.al/','#17372d')},
 logo('crepa-crepa',/^crepa crepa$/i,'https://wolt.com/en/alb/tirana/restaurant/crepa-crepa-tirana','#ffffff'),
 logo('hebs',/^heb['’]?s(?: bllok)?$/i,'https://wolt.com/en/alb/tirana/restaurant/hebs-bllok','#ffffff'),
 logo('delibros',/^delibros(?: .*)?$/i,'https://wolt.com/en/alb/tirana/restaurant/delibros-rruga-e-kavajs','#006538'),
 logo('mr-chicken',/^mr\.? chicken$/i,'https://wolt.com/en/alb/tirana/restaurant/mr-chicken01','#ffffff'),
 logo('hermanos',/^hermanos(?: burgers)?$/i,'https://wolt.com/en/alb/tirana/restaurant/hermanos-burgers-1','#ed2025'),
 logo('mono-mia',/^mono\s?mia(?: bakery(?: & pastry)?)?$/i,'https://wolt.com/en/alb/tirana/restaurant/mono-mia','#ffffff')
];
