/** Distance ranking is a streaming decision, not animation. Re-rank at 5 Hz,
 * but always return the current state objects so selected cars move every frame.
 * Teleports, vehicle entry and fleet replacement refresh immediately. */
export class FleetSelection {
  constructor({range=260,maxVisible=12,eligible=()=>true}={}) {
    this.range=range;this.maxVisible=maxVisible;this.eligible=eligible;
    this.selected=[];this.at=-Infinity;this.x=Infinity;this.z=Infinity;this.count=-1;
    this.playerCarId=undefined;this.first=undefined;this.last=undefined;
  }
  select(cars,viewer,playerCarId,now) {
    const refresh=now<this.at||now-this.at>=200||cars.length!==this.count||
      this.playerCarId!==playerCarId||cars[0]!==this.first||cars.at(-1)!==this.last||
      (viewer.x-this.x)**2+(viewer.z-this.z)**2>100;
    if(refresh){
      this.at=now;this.x=viewer.x;this.z=viewer.z;this.count=cars.length;
      this.playerCarId=playerCarId;this.first=cars[0];this.last=cars.at(-1);
      this.selected=cars.map(car=>({car,distance:(car.x-viewer.x)**2+(car.z-viewer.z)**2}))
        .filter(({car,distance})=>Number.isFinite(distance)&&this.eligible(car)&&(car.id===playerCarId||distance<(this.range+140)**2))
        .sort((a,b)=>Number(b.car.id===playerCarId)-Number(a.car.id===playerCarId)||a.distance-b.distance||a.car.id.localeCompare(b.car.id))
        .slice(0,this.maxVisible).map(({car})=>car.id);
    }
    const ids=new Set(this.selected),current=new Map();
    for(const car of cars)if(ids.has(car.id)&&Number.isFinite(car.x)&&Number.isFinite(car.z)&&this.eligible(car))current.set(car.id,car);
    return this.selected.map(id=>current.get(id)).filter(Boolean);
  }
}
