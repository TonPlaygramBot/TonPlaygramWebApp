export default function LadderIcon({ className = "" }) {
  const rungs = Array.from({ length: 5 }, (_, i) => 15 + i * 17);
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="8"
      strokeLinecap="round"
    >
      <line x1="30" y1="10" x2="30" y2="90" />
      <line x1="70" y1="10" x2="70" y2="90" />
      {rungs.map((y) => (
        <line key={y} x1="30" y1={y} x2="70" y2={y} />
      ))}
    </svg>
  );
}
