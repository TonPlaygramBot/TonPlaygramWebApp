import type { PlayerSide, ServeCourtSide } from "./gameConfig";

export type ServePhase = "ready" | "toss" | "swing" | "contact" | "ballFlight" | "fault" | "validServe";

export class ServeController {
  phase: ServePhase = "ready";
  firstServe = true;
  server: PlayerSide = "near";
  side: ServeCourtSide = "deuce";

  begin(side: ServeCourtSide, server: PlayerSide = this.server) {
    this.server = server;
    this.side = side;
    this.phase = "ready";
  }

  markToss() { this.phase = "toss"; }
  markContact() { this.phase = "contact"; }
  markFlight() { this.phase = "ballFlight"; }
  markValid() { this.phase = "validServe"; this.firstServe = true; }
  markFault() {
    if (this.firstServe) { this.firstServe = false; this.phase = "fault"; return false; }
    this.firstServe = true;
    this.phase = "fault";
    return true;
  }
}
