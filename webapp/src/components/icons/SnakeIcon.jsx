export default function SnakeIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="8"
      strokeLinecap="round"
    >
      <path d="M20 80 Q40 60 20 40 Q40 20 60 40 Q80 60 60 80" />
      <circle cx="60" cy="20" r="8" fill="currentColor" stroke="none" />
    </svg>
  );
}
