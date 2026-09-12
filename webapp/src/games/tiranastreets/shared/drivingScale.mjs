/** World positions are metres, velocity is m/s. HUD converts with *3.6. */
export function drivingScale(car) {
 const bus=car.model==='tirana-bus',sport=car.model==='sedan-sports'||car.model==='sport'||!!car.racingAsset;
 const bike=car.model==='motorbike'||car.forceVehicle?.includes('bike');
 const armored=car.model==='military-suv'||car.forceVehicle?.includes('armored');
 return {maximum:(bus?75:sport?155:bike?130:armored?90:110)/3.6,reverse:20/3.6,
   acceleration:bus?3.5:sport?9:bike?8:armored?4.5:6.5,braking:bus?9:armored?11:14};
}
export function cornerSpeed(headingError,cruise) {
 return Math.min(cruise,Math.max(2.2,cruise/(1+Math.abs(headingError)*3.2)));
}
