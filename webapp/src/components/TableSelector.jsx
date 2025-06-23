import React from 'react';

export default function TableSelector({ tables, selected, onSelect }) {
  return (
    <div className="space-y-2">
      {tables.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className={`w-full px-2 py-1 border rounded flex justify-between ${
            selected?.id === t.id ? 'bg-yellow-400 text-gray-900' : 'bg-gray-700 text-white'
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
