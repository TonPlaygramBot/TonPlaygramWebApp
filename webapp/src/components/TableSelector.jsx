import React from 'react';

export default function TableSelector({ tables, selected, onSelect }) {
  return (
    <div className="space-y-2">
      {tables.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className={`lobby-tile w-full flex justify-between ${
            selected?.id === t.id ? 'ring-2 ring-accent text-accent' : ''
          }`}
        >
          <span>{t.label || `Table ${t.capacity}p`}</span>
          {t.capacity && (
            <span>
              {t.players}/{t.capacity}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
