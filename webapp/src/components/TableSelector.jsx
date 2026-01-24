import React from 'react';
import OptionIcon from './OptionIcon.jsx';

export default function TableSelector({ tables, selected, onSelect }) {
  return (
    <div className="space-y-2">
      {tables.map((t, idx) => (
        <React.Fragment key={t.id}>
          {idx === 1 && tables[0]?.id === 'single' && <div className="h-4" />}
          <div className="relative">
          <button
            onClick={() => !t.disabled && onSelect(t)}
            disabled={t.disabled}
            className={`lobby-tile w-full flex justify-between ${
              selected?.id === t.id ? 'lobby-selected' : ''
            } ${t.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="flex items-center gap-2">
              {(t.icon || t.iconFallback) && (
                <OptionIcon
                  src={t.icon}
                  alt={t.iconAlt || t.label || 'Table'}
                  fallback={t.iconFallback || '🎲'}
                  className="h-5 w-5"
                />
              )}
              {t.label || `Table ${t.capacity}p`}
            </span>
            {t.capacity && (
              <span>
                {t.players}/{t.capacity}
              </span>
            )}
          </button>
          {t.disabled && (
            <span className="absolute inset-0 flex items-center justify-center text-xs bg-black bg-opacity-50 text-background">
              Under development
            </span>
          )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
