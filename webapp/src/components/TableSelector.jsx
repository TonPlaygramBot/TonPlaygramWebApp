import OptionIcon from './OptionIcon.jsx';

export default function TableSelector({ tables, selected, onSelect }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {tables.map((t) => {
        const isSelected = selected?.id === t.id;
        const subtitle = t.capacity && !t.hideSubtitle
          ? t.players
            ? `${t.players}/${t.capacity} players`
            : `${t.capacity} seats`
          : null;
        return (
          <div key={t.id} className="relative">
            <button
              onClick={() => !t.disabled && onSelect(t)}
              disabled={t.disabled}
              className={`lobby-option-card ${
                isSelected ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
              } ${t.disabled ? 'lobby-option-card-disabled' : ''}`}
            >
              <div className="lobby-option-thumb bg-gradient-to-br from-slate-400/30 via-slate-500/10 to-transparent">
                <div className="lobby-option-thumb-inner">
                  <OptionIcon
                    src={t.icon}
                    alt={t.iconAlt || t.label || 'Table'}
                    fallback={t.iconFallback || '🎲'}
                    className="lobby-option-icon"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="lobby-option-label">{t.label || `Table ${t.capacity || ''}`}</p>
                {subtitle && <p className="lobby-option-subtitle">{subtitle}</p>}
              </div>
            </button>
            {t.disabled && (
              <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-xs text-background">
                Under development
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
