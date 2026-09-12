export const CAMPUS_IDS=new Set(['174188540','174188545','344111050','344111059','344111131','467502142','467502143','467502157','467502158','467502169','467502170','467502179','467502180','548017163','548017164','548017165','548017460','548717179','548718011','1217286572','1217286573']);
export function housingProfile(b){
 if(CAMPUS_IDS.has(String(b.id))){const modern=['1217286572','1217286573'].includes(String(b.id)),colourful=String(b.id)==='548017164';return {kind:'campus',modern,colourful,colour:modern?0xe3e2da:colourful?0x74797c:0xbfc2b9,bay:modern?'campus-modern-bay':'campus-bay',spacing:modern?3.25:3.45,windowHeight:modern?1.9:1.65};}
 if(['house','detached','semidetached_house','terrace'].includes(b.tags?.building)&&!b.tags?.construction){const modern=b.roofShape==='flat';return{kind:'house',modern,colourful:false,colour:modern?0xd6d3c8:0xd0bfa4,bay:modern?'modern-house-bay':'house-bay',spacing:modern?3.6:3.5,windowHeight:modern?1.55:1.7};}
 return null;
}
