import {BUSINESS_SIGNS} from './businessSignRegistry.mjs';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
/** Bank, hotel and mall identity boards share one bounded instanced atlas draw. */
export class BuildingBrandLayer extends StreetLifeLayer {
 constructor(){
  super({storefronts:BUSINESS_SIGNS,stops:[],fuel:[],advertising:[]} as any,{},true);
  this.group.name='Tirana:mapped-business-identities';
 }
}
