// Focused regression gate for the combat/career update. The whole-app build and
// physical-device GPU checks remain separate and are documented in the report.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tests=[
 'blackwater.test.mjs','blackwaterOperation.test.mjs','blackwaterOnline.test.mjs',
 'tiranaBattlefieldTactics.test.mjs','tiranaBattlefieldSurface.test.mjs','tiranaBattlefieldCombatLoop.test.mjs',
 'tiranaMissionDirector.test.mjs','tiranaCrowdResponse.test.mjs','tiranaCombatFeedback.test.mjs',
 'tiranaHumanAnimation.test.mjs','tiranaImpactPresentation.test.mjs','tiranaAlbanianForcesRuntime.test.mjs',
 'tiranaDriverBattlefield.test.mjs','tiranaControls.test.mjs','tiranaMobileCombat.test.mjs','tiranaMobileRuntime.test.mjs',
 'tiranaNpcMotion.test.mjs','tiranaCityInfrastructure.test.mjs','tiranaCityLife.test.mjs','tiranaPatrolCustody.test.mjs',
 'tiranaPopulation.test.mjs','tiranaShopTerrain.test.mjs',
 'tiranaFullBodyCareer.test.mjs','tiranaGameplayOverhaul.test.mjs','tiranaStreetCareer.test.mjs',
 'tiranaStreetCareer.integration.test.mjs','tiranaCareerExpansion.test.mjs','tiranaPanoramaRuntime.test.mjs',
 'tiranaPedestrianDefense.test.mjs','tiranaPedestrianDefenseGameplay.test.mjs','tiranaVehicleDamageFlight.test.mjs'
];
const commands=[
 [process.execPath,['--test','--test-concurrency=2',...tests.map(t=>'test/'+t)]],
 ['npm',['run','test:navigation','--prefix','webapp','--',
   'src/games/tiranastreets/MovementStick.navigation.test.jsx',
   'src/games/tiranastreets/TiranaHud.navigation.test.jsx',
   'src/games/tiranastreets/MissionReview.navigation.test.jsx','--maxWorkers=1','--minWorkers=1']],
 [process.execPath,['webapp/node_modules/typescript/bin/tsc','-p','webapp/tsconfig.tirana-gameplay.json','--pretty','false']],
 ['git',['diff','--check']]
];
for(const [cmd,args] of commands){
 const result=spawnSync(cmd,args,{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
