declare module '*poolUk8Ball.js' {
  class UkPool {
    constructor(...args: any[]);
    state: any;
    rules: any;
    startBreak(): void;
    shotTaken(shot: any): any;
  }
  export { UkPool };
}

declare module '*americanBilliards.js' {
  class AmericanBilliards {
    constructor(...args: any[]);
    state: any;
    startBreak(): void;
    shotTaken(shot: any): any;
  }
  export { AmericanBilliards };
}

declare module '*nineBall.js' {
  class NineBall {
    constructor(...args: any[]);
    state: any;
    startBreak(): void;
    shotTaken(shot: any): any;
  }
  export { NineBall };
}
