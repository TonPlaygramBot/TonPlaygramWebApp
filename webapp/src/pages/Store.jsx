import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function Store() {
  useTelegramBackButton();

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <p className="text-subtext text-sm">No bundles are currently available.</p>
    </div>
  );
}
