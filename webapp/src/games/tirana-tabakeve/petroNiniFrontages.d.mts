import { QUARTER } from './quarterData.mjs';
type Unit = typeof QUARTER.shops[number] & {elevation:'basement'|'upper';approximate:true};
export function petroNiniFrontages(quarter?:typeof QUARTER):{
  bakery:Unit;office:Unit;
  market:typeof QUARTER.storefronts[number];restaurant:typeof QUARTER.storefronts[number];opposite:typeof QUARTER.storefronts[number];
}|null;
