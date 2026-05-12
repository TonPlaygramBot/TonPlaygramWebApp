import { gameConfig } from "./gameConfig";

export class CameraController {
  damping = gameConfig.cameraDamping;
  portraitFov(aspect: number) { return aspect < 0.72 ? 52 : 46; }
}
