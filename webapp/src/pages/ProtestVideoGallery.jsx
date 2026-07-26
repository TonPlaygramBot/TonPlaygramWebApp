import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaDownload, FaVideo } from 'react-icons/fa';

const joinUrl = (base, key) =>
  `${base.replace(/\/$/, '')}/${String(key).replace(/^\//, '')}`;

export default function ProtestVideoGallery() {
  const [videos, setVideos] = useState([]);
  const [publicUrl, setPublicUrl] = useState('');
  const [status, setStatus] = useState('loading');
  const [brokenThumbnails, setBrokenThumbnails] = useState([]);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch('/videos.json', { cache: 'no-store' }),
      fetch('/api/protest-videos/config', { cache: 'no-store' })
    ])
      .then(async ([videosResponse, configResponse]) => {
        if (!videosResponse.ok || !configResponse.ok) {
          throw new Error('Gallery data is unavailable.');
        }
        const [videoData, config] = await Promise.all([
          videosResponse.json(),
          configResponse.json()
        ]);
        if (!Array.isArray(videoData) || !config.publicUrl) {
          throw new Error('Gallery configuration is incomplete.');
        }
        if (active) {
          setVideos(videoData);
          setPublicUrl(config.publicUrl);
          setStatus('ready');
        }
      })
      .catch(() => active && setStatus('error'));

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <header className="overflow-hidden rounded-3xl border border-red-300/30 bg-gradient-to-br from-red-950 via-slate-950 to-black p-5 shadow-2xl">
        <Link
          to="/"
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-red-100"
        >
          <FaArrowLeft /> Back home
        </Link>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 text-2xl text-red-100">
            <FaVideo />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
              Protest gallery
            </p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
              Videos to watch and share
            </h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
          Download original protest footage directly to your phone. Tap any
          download button to save that video.
        </p>
      </header>

      {status === 'loading' && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Loading videos"
        >
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-3xl border border-white/10 bg-white/[0.04] p-3"
            >
              <div className="aspect-video rounded-2xl bg-white/10" />
              <div className="mt-4 h-5 w-2/3 rounded bg-white/10" />
              <div className="mt-4 h-11 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="rounded-2xl border border-red-400/40 bg-red-950/60 p-5 text-sm leading-6 text-red-100"
        >
          The video gallery could not load. Please try again later or ask the
          site owner to check the R2 public URL.
        </div>
      )}

      {status === 'ready' && videos.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
          No protest videos have been published yet.
        </div>
      )}

      {status === 'ready' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => {
            const thumbnailUrl = joinUrl(publicUrl, video.thumbnail);
            const videoUrl = joinUrl(publicUrl, video.video);
            const thumbnailFailed = brokenThumbnails.includes(video.id);

            return (
              <article
                key={video.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] p-3 shadow-xl"
              >
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
                  {thumbnailFailed ? (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FaVideo className="text-3xl" />
                      <span className="text-xs font-semibold">
                        Thumbnail unavailable
                      </span>
                    </div>
                  ) : (
                    <img
                      src={thumbnailUrl}
                      alt={`Thumbnail for ${video.title}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={() =>
                        setBrokenThumbnails((current) => [...current, video.id])
                      }
                    />
                  )}
                </div>
                <div className="p-2 pt-4">
                  <h2 className="text-lg font-black leading-6 text-white">
                    {video.title}
                  </h2>
                  <a
                    href={videoUrl}
                    download
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  >
                    <FaDownload /> Download video
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
