import './ThreeDice.css';
import { rollingGif, diceFaces } from '../assets/diceImages';

export default function ThreeDice({ value = 1, rolling = false }) {
  const src = rolling ? rollingGif : diceFaces[value];

  return (
    <img
      src={src}
      alt={`Dice showing ${value}`}
      className="dice-img"
    />
  );
}
