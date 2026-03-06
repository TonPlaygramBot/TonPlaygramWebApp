const TASK_VIDEO = {
  shortUrl: 'https://vt.tiktok.com/ZSuREWyqx/',
  canonicalUrl: 'https://www.tiktok.com/@tonplaygram/video/7538028530903387448',
  embedUrl:
    'https://www.tiktok.com/embed/v2/7538028530903387448?autoplay=1&mute=1&loop=1',
};

export default function TaskPromoVideo({ className = '' }) {
  return (
    <div className={`w-full max-w-sm mx-auto ${className}`.trim()}>
      <div className="rounded-xl overflow-hidden border border-border bg-black/40">
        <iframe
          src={TASK_VIDEO.embedUrl}
          title="TonPlaygram TikTok task video"
          className="w-full h-[360px]"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      <a
        href={TASK_VIDEO.canonicalUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block text-xs text-subtext hover:text-white"
      >
        Open on TikTok ↗
      </a>
    </div>
  );
}

export { TASK_VIDEO };
