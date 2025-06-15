import { useEffect, useRef } from 'react';
import './ThreeDice.css';

const pipMap = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const Face = ({ value }) => {
  const cells = Array.from({ length: 9 });
  return (
    <>
      {cells.map((_, i) => (
        <span key={i} className={pipMap[value]?.includes(i) ? 'pip' : ''}></span>
      ))}
    </>
  );
};

export default function ThreeDice({ value = 1, rolling = false }) {
  const diceRef = useRef(null);

  useEffect(() => {
    if (rolling && diceRef.current) {
      diceRef.current.classList.add('rolling');
      const id = setTimeout(() => {
        diceRef.current && diceRef.current.classList.remove('rolling');
      }, 800);
      return () => clearTimeout(id);
    }
  }, [rolling]);

  return (
    <div ref={diceRef} className="dice3d">
      <div className="face front">
        <Face value={value} />
      </div>
      <div className="face back">
        <Face value={value} />
      </div>
      <div className="face right">
        <Face value={value} />
      </div>
      <div className="face left">
        <Face value={value} />
      </div>
      <div className="face top">
        <Face value={value} />
      </div>
      <div className="face bottom">
        <Face value={value} />
      </div>
    </div>
  );
}
