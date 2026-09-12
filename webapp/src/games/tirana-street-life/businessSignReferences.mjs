/** Official operator/trade-association artwork. Matches are explicit identities,
 * never a generic hotel/bank/restaurant category or an approximate name. */
const logo=(id,match,source,background='#ffffff')=>({id,match,logo:`/assets/tirana-streets/signs/${id}-logo.png`,source,background,foreground:background==='#ffffff'?'#222222':'#ffffff',crop:null});
const banks='https://aab.al/en/';
export const BUSINESS_SIGN_REFERENCES=[
 logo('bkt',/^(?:bkt|banka kombetare tregtare)(?: bank)?$/i,banks),
 logo('credins',/^(?:banka )?credins(?: bank)?(?: - headquarter)?$/i,banks),
 logo('raiffeisen',/^raiffeisen(?: bank)?$/i,banks),
 logo('intesa',/^intesa sanpaolo(?: bank)?(?: albania)?$/i,banks),
 logo('otp',/^otp(?: bank)?(?: albania)?$/i,banks),
 logo('union',/^(?:union\s?bank|unjon bank)(?: dega blloku)?$/i,banks),
 logo('abi',/^(?:abi(?: bank)?|banka amerikane e investimeve)$/i,banks),
 logo('tirana-bank',/^tirana bank$/i,banks),
 logo('fibank',/^fibank$/i,banks),
 logo('procredit',/^procredit(?: bank)?$/i,banks),
 logo('uba',/^(?:uba|united bank of albania|banka e bashkuar e shqiperise)$/i,banks),
 logo('big-market',/^big market$/i,'https://bigmarket.al/'),
 logo('conad',/^conad$/i,'https://www.conadalbania.al/'),
 logo('eco-market',/^eco market$/i,'https://ecomarket.al/'),
 logo('sophie',/^sophie(?: caffe(?: & snacks)?)?$/i,'https://www.sophiecaffe.com/'),
 logo('kfc',/^kfc$/i,'https://toptani.com.al/en/content/100-kfc'),
 logo('burger-king',/^burger king$/i,'https://toptani.com.al/en/','#000000'),
 logo('xheko',/^xheko imperial(?: luxury)?(?: hotel)?(?: & spa)?$/i,'https://xheko-imperial.com/'),
 logo('rogner',/^(?:hotel )?rogner(?: hotel)?(?: tirana)?$/i,'https://www.hotel-europapark.com/','#16232c'),
 logo('plaza',/^(?:the plaza(?: · tid tower)?|maritim (?:hotel )?plaza tirana)$/i,'https://www.plazatirana.com/'),
 logo('tirana-international',/^tirana international hotel(?: & conference cent(?:re|er))?$/i,'https://tiranainternational.com/'),
 logo('mondial',/^(?:hotel mondial|mondial(?: hotel)?)$/i,'https://www.hotelmondial.al/'),
 logo('dinasty',/^(?:hotel dinasty|dinasty(?: hotel)?)$/i,'https://dinastyhotel.al/en/'),
 logo('monarc',/^monarc(?: boutique hotel)?$/i,'https://www.monarc.al/'),
 logo('senator',/^(?:hotel senator|senator(?: hotel)?)$/i,'https://hotelsenator-al.com/'),
 logo('gloria',/^(?:hotel gloria|gloria(?: boutique hotel)?(?: & restaurant)?)$/i,'https://www.hotelboutiquegloria.al/','#16232c'),
 logo('elysee',/^(?:hotel elysee|elysee(?: hotel)?)$/i,'https://hotelelysee.al/')
];
