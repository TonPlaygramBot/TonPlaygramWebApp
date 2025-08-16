import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PoolRoyale() {
  useTelegramBackButton();
  const params = new URLSearchParams(window.location.search);
  const src = `/poolroyale/index.html?${params.toString()}`;
  return (
    <div className="w-full h-full">
      <iframe src={src} title="8 Pool Royale" className="w-full h-screen border-0" />
    </div>
  );
}
