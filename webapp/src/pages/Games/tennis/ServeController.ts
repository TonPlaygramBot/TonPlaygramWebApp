import { PlayerSide, ServeSide, TennisBallState } from "./gameConfig";

export type ServePhase = "ready" | "toss" | "swing" | "contact" | "ballFlight" | "fault" | "valid";

export class ServeController {
  phase: ServePhase = "ready";
  firstServe = true;
  server: PlayerSide = "near";
  side: ServeSide = "deuce";

  start(server: PlayerSide, side: ServeSide) {
    this.server = server;
    this.side = side;
    this.phase = "ready";
    this.firstServe = true;
  }

  beginToss() { this.phase = "toss"; }
  markContact() { this.phase = "contact"; return TennisBallState.ServeHit; }
  markFlight() { this.phase = "ballFlight"; }
  markValid() { this.phase = "valid"; this.firstServe = true; }
  markFault() {
    if (this.firstServe) {
      this.firstServe = false;
      this.phase = "fault";
      return "fault" as const;
    }
    this.phase = "fault";
    this.firstServe = true;
    return "doubleFault" as const;
  }
}
