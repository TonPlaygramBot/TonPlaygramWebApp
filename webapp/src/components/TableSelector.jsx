import React from 'react';

export default function TableSelector({ tables, selected, onSelect }) {
  return (
    <div className="space-y-2">
      {tables.map((t, idx) => (
        <React.Fragment key={t.id}>
          {idx === 1 && tables[0]?.id === 'single' && (
            <div className="h-4" />
          )}
          <button
            onClick={() => onSelect(t)}
            className={`lobby-tile w-full flex justify-between ${
              selected?.id === t.id ? 'lobby-selected' : ''
            }`}
          >
            <span>{t.label || `Table ${t.capacity}p`}</span>
            {t.capacity && (
              <span>
                {t.players}/{t.capacity}
              </span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
