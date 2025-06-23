import { useEffect, useState } from 'react';

export default function NeonFrame({ boardRef, containerRef }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const update = () => {
      if (boardRef?.current) {
        setRect(boardRef.current.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener('resize', update);
    const c = containerRef?.current;
    c?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      c?.removeEventListener('scroll', update);
    };
  }, [boardRef, containerRef]);

  if (!rect) return null;

  const width = 8;
  const offset = 10;
  const left = rect.left - offset;
  const right = rect.right + offset - width;
  const top = Math.max(rect.top - offset, 0);
  const bottom = rect.bottom + offset;

  const baseStyle = {
    position: 'fixed',
    backgroundColor: '#0ff',
    boxShadow: '0 0 8px #0ff, 0 0 16px #0ff',
    pointerEvents: 'none',
    zIndex: 1000,
  };

  return (
    <>
      <div
        style={{
          ...baseStyle,
          width: `${width}px`,
          height: `${bottom}px`,
          left: `${left}px`,
          top: 0,
        }}
      />
      <div
        style={{
          ...baseStyle,
          width: `${width}px`,
          height: `${bottom}px`,
          left: `${right}px`,
          top: 0,
        }}
      />
      <div
        style={{
          ...baseStyle,
          height: `${width}px`,
          width: `${right - left + width}px`,
          left: `${left}px`,
          top: `${top}px`,
        }}
      />
    </>
  );
}
