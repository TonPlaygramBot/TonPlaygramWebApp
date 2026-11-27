import {loadGameMode} from './loadGameMode';
import {createSharedCareerLoad} from './careerWarmupPolicy.mjs';

export const loadStreetCareer=createSharedCareerLoad(()=>
 loadGameMode('street-career',()=>import('../tiranastreets-november/street-career/StreetCareerGame')
  .then(module=>({default:module.StreetCareerGame})))
);
