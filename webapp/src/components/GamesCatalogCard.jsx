import { Link } from 'react-router-dom';

export default function GamesCatalogCard({ game }) {
  const {
    name,
    category,
    thumbnail,
    tagline,
    stats = [],
    tags = [],
    lobbyRoute,
    playRoute,
    badge
  } = game;

  return (
    <article className="relative overflow-hidden rounded-2xl bg-surface border border-border shadow-lg backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="relative h-36 w-full overflow-hidden bg-background">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        {badge ? (
          <span className="absolute top-3 right-3 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-black shadow-lg">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold leading-snug text-yellow-400" style={{ WebkitTextStroke: '1px black' }}>
            {name}
          </h3>
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-subtext">
            {category}
          </span>
        </div>
        {tagline ? <p className="text-sm text-subtext leading-snug">{tagline}</p> : null}

        {stats.length ? (
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {stats.map(({ label, value }) => (
              <div key={`${label}-${value}`} className="rounded-lg border border-border bg-background/70 px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-subtext">{label}</dt>
                <dd className="font-semibold text-text">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {tags.length ? (
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-subtext">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-background px-3 py-1">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            to={lobbyRoute}
            className="inline-flex items-center justify-center rounded-full border border-primary bg-primary px-3 py-2 text-sm font-semibold text-black shadow-lg shadow-primary/40 transition hover:bg-primary-hover"
          >
            Lobby
          </Link>
          <Link
            to={playRoute}
            className="inline-flex items-center justify-center rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold text-text transition hover:border-primary"
          >
            Play
          </Link>
        </div>
      </div>
    </article>
  );
}
