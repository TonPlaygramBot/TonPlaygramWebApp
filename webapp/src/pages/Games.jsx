import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';
import {
  fetchPersonaPlexVoices,
  getSelectedVoicePromptId,
  setSelectedVoicePromptId,
  speakCommentaryLines
} from '../utils/textToSpeech.js';

export default function Games() {
  useTelegramBackButton();
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [voicePromptId, setVoicePromptIdState] = useState(() => getSelectedVoicePromptId());
  const [previewStatus, setPreviewStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadVoices = async () => {
      const res = await fetchPersonaPlexVoices({ force: true });
      if (cancelled || res?.error) return;
      setVoiceOptions(Array.isArray(res.voices) ? res.voices : []);
    };
    void loadVoices();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasVoiceSelection = useMemo(() => Boolean(voicePromptId), [voicePromptId]);

  const previewGameCommentary = async (game) => {
    setPreviewStatus(`Generating commentary for ${game.name}...`);
    try {
      await speakCommentaryLines(
        [
          {
            speaker: 'Arena Host',
            text: `${game.name} match is live. Big play incoming!`,
            eventType: 'LOBBY_PREVIEW',
            eventPayload: { gameSlug: game.slug, gameName: game.name }
          }
        ],
        { channel: 'commentary' }
      );
      setPreviewStatus(`Now speaking ${game.name} commentary.`);
    } catch (error) {
      setPreviewStatus(`Commentary unavailable: ${String(error?.message || error)}`);
    }
  };

  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Games Lobby</h2>
      <p className="text-center text-sm text-subtext">
        Jump straight into a lobby. Tap any game to start your next match.
      </p>

      <section className="rounded-xl border border-border bg-surface/80 p-3 space-y-2">
        <h3 className="text-sm font-semibold text-white">Voice Commentary (All Games)</h3>
        <p className="text-xs text-subtext">
          Select a PersonaPlex voice prompt and preview commentary before entering a lobby.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="px-2 py-2 rounded-lg border border-border bg-surface text-xs text-white"
            value={voicePromptId}
            onChange={(event) => {
              const next = setSelectedVoicePromptId(event.target.value);
              setVoicePromptIdState(next);
            }}
          >
            <option value="">Default PersonaPlex voice</option>
            {voiceOptions.map((voice) => (
              <option key={voice.voicePromptId} value={voice.voicePromptId}>
                {voice.label || voice.voicePromptId}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-subtext">
            {hasVoiceSelection ? `Voice prompt: ${voicePromptId}` : 'Using default voice prompt'}
          </span>
        </div>
        {previewStatus ? <p className="text-xs text-primary">{previewStatus}</p> : null}
      </section>

      <div className="grid grid-cols-3 gap-3">
        {gamesCatalog.map((game) => {
          const thumbnail = getGameThumbnail(game.slug);
          return (
            <div key={game.name} className="space-y-1">
              <Link
                to={game.route}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-lg transition hover:-translate-y-0.5 hover:border-primary/60"
              >
                <div className="relative h-24 overflow-hidden">
                  <img
                    src={thumbnail || game.image}
                    alt={game.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.src = game.image;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute bottom-1 left-1 right-1 text-center text-xs font-semibold text-white">
                    {game.name}
                  </span>
                </div>
                <div className="flex flex-1 flex-col items-center px-2 py-2 text-center">
                  <p className="text-[10px] text-subtext line-clamp-2">{game.description}</p>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Enter Lobby
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => void previewGameCommentary(game)}
                className="w-full rounded-lg border border-border bg-background/60 px-2 py-1 text-[10px] font-semibold text-white"
              >
                ▶ Preview Commentary
              </button>
            </div>
          );
        })}
      </div>
      <GameTransactionsCard />
      <LeaderboardCard />
    </div>
  );
}
