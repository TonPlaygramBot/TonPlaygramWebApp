import { useState } from 'react';
import './profile-layouts.css';

export type ProfileColumns = 1 | 2 | 3 | 4;
const preferenceKey = 'tonplaygram-profile-columns';

export function useProfileColumns() {
  const [columns, setColumns] = useState<ProfileColumns>(() => {
    try {
      const saved = Number(localStorage.getItem(preferenceKey));
      if ([1, 2, 3, 4].includes(saved)) return saved as ProfileColumns;
    } catch { /* The layout still works when storage is unavailable. */ }
    return 3;
  });
  return [columns, (value: ProfileColumns) => {
    setColumns(value);
    try { localStorage.setItem(preferenceKey, String(value)); } catch { /* Optional preference. */ }
  }] as const;
}

export default function ProfileLayoutSwitcher({ columns, onChange }: {
  columns: ProfileColumns;
  onChange: (columns: ProfileColumns) => void;
}) {
  return <div className="wall-profile-layout-bar">
    <div><strong>Posts</strong><small>{columns === 1 ? 'Full posts' : `${columns} columns`}</small></div>
    <div className="wall-profile-layouts" role="group" aria-label="Profile post layout">
      {([1, 2, 3, 4] as const).map(count => <button
        type="button" key={count} aria-label={`${count} ${count === 1 ? 'column' : 'columns'}`}
        title={count === 1 ? '1 column · Full posts' : `${count} columns`}
        aria-pressed={columns === count} onClick={() => onChange(count)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
          {Array.from({ length: count * 2 }, (_, index) => <rect key={index}
            x={2 + (index % count) * (21 / count)} y={3 + Math.floor(index / count) * 10}
            width={21 / count - 2} height="8" rx="1" />)}
        </svg>
      </button>)}
    </div>
  </div>;
}
