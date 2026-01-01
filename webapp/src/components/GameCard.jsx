import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function GameCard({
  title,
  description,
  link,
  icon,
  genre,
  meta = [],
  features = [],
  inlineActions
}) {
  let iconNode = null;
  if (icon) {
    iconNode =
      typeof icon === 'string'
        ? <img src={icon} alt="" className="h-10 w-10 object-contain mx-auto drop-shadow" />
        : React.isValidElement(icon)
          ? icon
          : <span className="text-3xl text-accent">{icon}</span>;
  }

  return (
    <div className="relative bg-surface border border-border rounded-2xl p-4 shadow-lg space-y-3 overflow-hidden wide-card">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-black/40 border border-border flex items-center justify-center">
          {iconNode}
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-yellow-400" style={{ WebkitTextStroke: '1px black' }}>
            {title}
          </h3>
          {genre && <p className="text-xs uppercase tracking-wide text-subtext">{genre}</p>}
          {description && <p className="text-subtext text-sm leading-snug">{description}</p>}
        </div>
      </div>

      {meta?.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {meta.map(({ label, value }) => (
            <div key={`${label}-${value}`} className="rounded-lg border border-border/60 bg-background/40 px-2 py-2">
              <p className="text-[11px] uppercase tracking-wide text-subtext">{label}</p>
              <p className="font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {features?.length > 0 && (
        <ul className="list-disc list-inside space-y-1 text-sm text-subtext">
          {features.map((item) => (
            <li key={item} className="leading-snug">{item}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        {inlineActions}
        {link && (
          <Link
            to={link}
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover rounded-full text-black text-sm font-semibold shadow-lg shadow-primary/40"
          >
            Open lobby
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}
