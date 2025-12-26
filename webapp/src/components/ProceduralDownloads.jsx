import { useMemo } from 'react';
import { FiDownload, FiPackage } from 'react-icons/fi';

import { buildProceduralBundle, getProceduralLibraryEntries } from '../utils/proceduralGltf.js';

const downloadTextFile = (text, fileName, mimeType) => {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export default function ProceduralDownloads() {
  const entries = useMemo(() => getProceduralLibraryEntries(), []);

  const handleDownload = (entry) => {
    downloadTextFile(entry.download.text, entry.download.fileName, 'model/gltf+json');
  };

  const handleBundleDownload = () => {
    const bundle = buildProceduralBundle(entries);
    downloadTextFile(
      JSON.stringify(bundle, null, 2),
      'tonplaygram-procedural-library.json',
      'application/json'
    );
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">Procedural GLTF kit</h3>
          <p className="text-sm text-subtext">
            Lightweight, text-only glTFs you can download inside the PWA. Each mesh is generated on-device—
            no binary payloads—so you can plug them into your games or bake your own GLB exports.
          </p>
        </div>
        <button
          type="button"
          onClick={handleBundleDownload}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-primary text-surface rounded-full shadow-primary/40 hover:shadow-primary/60 shadow"
        >
          <FiPackage />
          Download all (.json)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="border border-border rounded-lg p-3 bg-background/60 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-white font-semibold leading-tight">{entry.name}</p>
                <p className="text-xs text-subtext">{entry.description}</p>
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-[11px] rounded-full border border-border text-primary bg-primary/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(entry)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-primary text-surface rounded-full shadow-primary/40 hover:shadow-primary/60 shadow"
              >
                <FiDownload className="w-4 h-4" />
                Download .gltf
              </button>
            </div>
            <div className="text-[11px] text-subtext flex flex-wrap gap-3">
              <span>~{entry.download.sizeKb} KB</span>
              <span>{entry.stats.vertices} vertices</span>
              <span>{entry.stats.triangles} triangles</span>
              <span>Pure JSON (no embedded binary files)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
