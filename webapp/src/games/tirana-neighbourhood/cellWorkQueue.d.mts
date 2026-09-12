export class CellWorkQueue {
 sync(tasks:{key:string;create:()=>Generator<void,void>}[]):void;
 run(budget:number,maxSteps:number,clock?:()=>number):void;
 readonly length:number;
 dispose():void;
}
