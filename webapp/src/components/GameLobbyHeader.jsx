import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';

const resolveGameInfo = (slug) => gamesCatalog.find((game) => game.slug === slug);

export default function GameLobbyHeader({ slug, title, badge, description }) {
  const game = resolveGameInfo(slug);
  const image = getGameThumbnail(slug) || game?.image;
  const gameName = game?.name || title || 'Game Lobby';
  const info = description || game?.description;
  const heading = title || `${gameName} Lobby`;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 via-[#0f172a]/80 to-[#0b1324]/90 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-48 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 sm:h-48 sm:w-48">
            {image ? (
              <img src={image} alt={gameName} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl">🎮</div>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/70">{gameName}</p>
            <h2 className="text-2xl font-bold text-white">{heading}</h2>
            {info && <p className="mt-2 text-sm text-white/70">{info}</p>}
          </div>
        </div>
        {badge && (
          <div className="self-start rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80 sm:self-center">
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}
