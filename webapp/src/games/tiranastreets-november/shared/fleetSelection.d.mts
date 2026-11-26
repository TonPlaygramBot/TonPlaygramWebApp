type FleetCar={id:string;x:number;z:number};
export class FleetSelection<T extends FleetCar=FleetCar> {
  constructor(options?:{range?:number;maxVisible?:number;eligible?:(car:T)=>boolean});
  select(cars:readonly T[],viewer:{x:number;z:number},playerCarId:string|null|undefined,now:number):T[];
}
