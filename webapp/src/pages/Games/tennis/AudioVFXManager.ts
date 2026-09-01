export class AudioVFXManager {
  racketHit = new Audio("https://assets.mixkit.co/active_storage/sfx/1104/1104-preview.mp3");
  courtBounce = new Audio("https://assets.mixkit.co/active_storage/sfx/522/522-preview.mp3");
  netHit = new Audio("/assets/sounds/goal net.mp3");
  pointWon = new Audio("/assets/sounds/crowd-cheering-383111.mp3");

  constructor() {
    this.racketHit.volume = 0.62;
    this.courtBounce.volume = 0.4;
    this.netHit.volume = 0.42;
    this.pointWon.volume = 0.32;
  }

  play(sound: "racket" | "bounce" | "net" | "point") {
    const item = sound === "racket" ? this.racketHit : sound === "bounce" ? this.courtBounce : sound === "net" ? this.netHit : this.pointWon;
    void item.play().catch(() => {});
  }
}
