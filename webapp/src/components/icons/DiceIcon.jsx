export default function DiceIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="5"
    >
      <rect x="15" y="15" width="70" height="70" rx="15" fill="none" />
      <circle cx="35" cy="35" r="8" />
      <circle cx="65" cy="65" r="8" />
      <circle cx="35" cy="65" r="8" />
      <circle cx="65" cy="35" r="8" />
    </svg>
  );
}
