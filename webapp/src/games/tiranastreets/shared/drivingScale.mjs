/** World positions are metres, velocity is m/s. HUD converts with *3.6. */
export function drivingScale(car) {
 const bus=car.model==='tirana-bus',sport=car.model==='sedan-sports';
 return {maximum:(bus?45:sport?70:55)/3.6,reverse:12/3.6,acceleration:bus?1.4:sport?4.2:3.0,braking:bus?5:7.5};
}
export function cornerSpeed(headingError,cruise) {
 return Math.min(cruise,Math.max(2.2,cruise/(1+Math.abs(headingError)*3.2)));
}
