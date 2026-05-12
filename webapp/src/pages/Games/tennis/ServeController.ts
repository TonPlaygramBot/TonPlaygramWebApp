import * as THREE from "three";
import { gameConfig, PlayerSide, ServeCourtSide } from "./gameConfig";

export type ServeState = "ready" | "toss" | "swing" | "contact" | "ballFlight" | "fault" | "doubleFault" | "let" | "ace" | "validServe";

export class ServeController {
  public state: ServeState = "ready";
  public server: PlayerSide = "near";
  public side: ServeCourtSide = "deuce";
  public firstServe = true;

  constructor(private cfg = gameConfig) {}
  begin(server: PlayerSide, side: ServeCourtSide, firstServe = true) { this.server = server; this.side = side; this.firstServe = firstServe; this.state = "ready"; }
  startToss() { if (this.state === "ready") this.state = "toss"; }
  startSwing() { if (this.state === "toss" || this.state === "ready") this.state = "swing"; }
  canContact(swingT: number, ballPosition: THREE.Vector3) { return swingT >= this.cfg.serveContactT && ballPosition.y >= this.cfg.minContactHeight * 3.8; }
  markContact() { this.state = "contact"; }
  markFlight() { this.state = "ballFlight"; }
  markFault(doubleFault = false) { this.state = doubleFault ? "doubleFault" : "fault"; this.firstServe = doubleFault ? true : false; }
  markValidServe() { this.state = "validServe"; }
}
