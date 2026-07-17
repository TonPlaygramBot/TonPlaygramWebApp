import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaDownload, FaUpload, FaVideo } from 'react-icons/fa';
import { useTonAddress } from '@tonconnect/ui-react';
import { uploadProtestVideo } from '../utils/api.js';

const PROTEST_VIDEO_LIBRARY_URL = '/ProtestVideo/library.json';
const PROTEST_VIDEO_BASE_URL = '/ProtestVideo/';
const DEV_ACCOUNTS = [
  import.meta.env.VITE_DEV_ACCOUNT_ID,
  import.meta.env.VITE_DEV_ACCOUNT_ID_1,
  import.meta.env.VITE_DEV_ACCOUNT_ID_2
].filter(Boolean);

const getStoredWalletAddress = () => {
  try {
    return localStorage.getItem('walletAddress') || '';
  } catch {
    return '';
  }
};

const normalizeAddress = (address) =>
  String(address || '')
    .trim()
    .toLowerCase();

const getVideoId = (video) => video.id || video.file || video.url;

const formatBytes = (bytes = 0) => {
  if (!bytes) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function ProtestVideoGallery() {
  const tonAddress = useTonAddress();
  const fileInputRef = useRef(null);
  const [libraryVideos, setLibraryVideos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [uploadDate, setUploadDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('loading');
  const [walletAddress, setWalletAddress] = useState(
    () => tonAddress || getStoredWalletAddress()
  );

  const isDev = useMemo(() => {
    const account = normalizeAddress(tonAddress || walletAddress);
    return (
      import.meta.env.DEV ||
      DEV_ACCOUNTS.some(
        (devAccount) => normalizeAddress(devAccount) === account
      )
    );
  }, [tonAddress, walletAddress]);

  useEffect(() => {
    setWalletAddress(tonAddress || getStoredWalletAddress());
  }, [tonAddress]);

  useEffect(() => {
    fetch(PROTEST_VIDEO_LIBRARY_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok)
          throw new Error('Unable to load protest video library.');
        return response.json();
      })
      .then((library) => {
        const videos = Array.isArray(library?.videos) ? library.videos : [];
        setLibraryVideos(
          videos.map((video) => ({
            ...video,
            source: 'library',
            url: `${PROTEST_VIDEO_BASE_URL}${video.file || ''}`
          }))
        );
        setStatus('ready');
      })
      .catch(() => {
        setLibraryVideos([]);
        setStatus('error');
      });
  }, []);

  const allVideos = useMemo(() => libraryVideos, [libraryVideos]);
  const selectedVideos = allVideos.filter((video) =>
    selectedIds.includes(getVideoId(video))
  );


  const chooseUploadFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((file) =>
      file.type.startsWith('video/')
    );
    setPendingUploadFiles(files);
    setUploadStatus(
      files.length
        ? `${files.length} video clip${files.length > 1 ? 's' : ''} ready. Tap Upload to publish.`
        : 'Choose a video clip from your phone first.'
    );
  };

  const uploadPendingFiles = async () => {
    if (!pendingUploadFiles.length) {
      setUploadStatus('Choose a video clip from your phone first.');
      return;
    }

    setIsUploading(true);
    setUploadStatus(
      `Uploading ${pendingUploadFiles.length} video clip${pendingUploadFiles.length > 1 ? 's' : ''}…`
    );

    const uploaded = [];
    for (const file of pendingUploadFiles) {
      const result = await uploadProtestVideo(file, { date: uploadDate });
      if (result.error) {
        setUploadStatus(result.error);
        setIsUploading(false);
        return;
      }
      if (result.video) uploaded.push(result.video);
    }

    setLibraryVideos((current) => [...uploaded, ...current]);
    setSelectedIds((current) => [
      ...new Set([...uploaded.map(getVideoId), ...current])
    ]);
    setPendingUploadFiles([]);
    setUploadStatus('Upload complete. Your clips are now published in the gallery.');
    setIsUploading(false);
  };

  const handleUpload = (event) => {
    chooseUploadFiles(event.target.files);
    event.target.value = '';
  };


  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const downloadSelected = () => {
    selectedVideos.forEach((video, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = video.url;
        link.download =
          video.fileName ||
          video.file ||
          `${video.title || 'protest-video'}.mp4`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 250);
    });
  };

  return (
    <div className="space-y-4 pb-6">
      <header className="rounded-3xl border border-red-300/40 bg-gradient-to-br from-red-950/90 via-slate-950 to-black p-4 shadow-xl">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-red-100"
        >
          <FaArrowLeft /> Back home
        </Link>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-red-500/20 p-3 text-2xl text-red-100">
            <FaVideo />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
              ProtestVideo Gallery
            </p>
            <h1 className="text-2xl font-black text-white">
              Organized video downloads
            </h1>
            <p className="mt-2 text-sm leading-6 text-subtext">
              Select one video or many videos, then download them together.
              Published videos are grouped by their protest date.
            </p>
          </div>
        </div>
      </header>

      {isDev && (
        <section className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            Developer only
          </p>
          <h2 className="mt-1 text-lg font-black text-white">
            Direct page uploads
          </h2>
          <p className="mt-1 text-sm text-subtext">
            Add clips directly from your phone gallery/camera roll. Choose the
            protest date once, then upload clips up to 1GB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <label className="mt-3 block text-xs font-bold uppercase tracking-[0.16em] text-amber-100">
            Clip date
          </label>
          <input
            type="date"
            value={uploadDate}
            onChange={(event) => setUploadDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white"
          />
          <button
            type="button"
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingUpload(true);
            }}
            onDragLeave={() => setIsDraggingUpload(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingUpload(false);
              chooseUploadFiles(event.dataTransfer.files);
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            disabled={isUploading}
            className={`mt-3 inline-flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-5 text-sm font-black ${
              isDraggingUpload
                ? 'border-amber-100 bg-amber-200 text-slate-950'
                : 'border-amber-200/60 bg-amber-300 text-slate-950'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <FaUpload /> {pendingUploadFiles.length ? 'Change selected clips' : 'Choose clips from phone'}
            </span>
            <span className="text-xs font-semibold opacity-80">
              Opens your phone gallery/camera roll. Clips stay private until you
              confirm with the Upload button below.
            </span>
          </button>
          {pendingUploadFiles.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-200/40 bg-black/30 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-100">
                Ready to upload
              </p>
              <ul className="mt-2 space-y-1 text-xs font-semibold text-white">
                {pendingUploadFiles.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`} className="truncate">
                    {file.name} · {formatBytes(file.size)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={uploadPendingFiles}
                disabled={isUploading}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaUpload /> {isUploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          )}
          {uploadStatus && (
            <p className="mt-3 rounded-xl bg-black/30 p-3 text-sm font-semibold text-amber-50">
              {uploadStatus}
            </p>
          )}
        </section>
      )}

      <section className="sticky top-2 z-10 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-white">
            {selectedVideos.length} selected
          </p>
          <button
            type="button"
            disabled={!selectedVideos.length}
            onClick={downloadSelected}
            className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download selected
          </button>
        </div>
      </section>

      {status === 'loading' && (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-subtext">
          Loading video library…
        </p>
      )}
      {status === 'error' && (
        <p className="rounded-2xl border border-red-400/40 bg-red-950/50 p-4 text-sm text-red-100">
          The published video library could not load. Check
          public/ProtestVideo/library.json.
        </p>
      )}
      {status === 'ready' && allVideos.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-subtext">
          No videos are published yet.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4">
        {allVideos.map((video) => {
          const id = getVideoId(video);
          const recordedAt = video.date;
          const checked = selectedIds.includes(id);

          return (
            <article
              key={id}
              className={`rounded-3xl border p-3 ${checked ? 'border-red-200 bg-red-500/10' : 'border-white/10 bg-white/[0.04]'}`}
            >
              <label className="mb-3 flex items-center gap-3 rounded-2xl bg-black/20 p-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelected(id)}
                  className="h-5 w-5 accent-red-500"
                />
                <span className="text-sm font-bold text-white">
                  Select for download
                </span>
              </label>
              <video
                className="aspect-video w-full rounded-2xl bg-black object-cover"
                src={video.url}
                controls
                preload="metadata"
              />
              <div className="mt-3 space-y-2">
                <h3 className="text-lg font-black capitalize text-white">
                  {video.title || 'Untitled protest video'}
                </h3>
                <p className="text-xs font-semibold text-red-200">
                  {recordedAt || 'Date and time not set'}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100">
                    {formatBytes(video.size)}
                  </span>
                  <a
                    href={video.url}
                    download={video.fileName || video.file}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950"
                  >
                    <FaDownload /> Download
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
