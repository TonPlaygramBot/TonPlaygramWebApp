export function createRaceSimulation({ canvasWidth, canvasHeight, laps }) {
  const kart = {
    x: 56,
    y: canvasHeight / 2,
    width: 24,
    height: 16,
    speedX: 2.4,
    speedY: 3.2
  };

  let currentLap = 1;
  let finished = false;

  return {
    getState() {
      return {
        kart,
        currentLap,
        finished
      };
    },
    update(input) {
      if (finished) return { lapChanged: false, finished: true };

      if (input.up) kart.y -= kart.speedY;
      if (input.down) kart.y += kart.speedY;

      kart.y = Math.max(40, Math.min(canvasHeight - 40, kart.y));
      kart.x += kart.speedX;

      let lapChanged = false;
      if (kart.x > canvasWidth - 40) {
        kart.x = 56;
        currentLap += 1;
        lapChanged = true;
        if (currentLap > laps) finished = true;
      }

      return { lapChanged, finished };
    }
  };
}
