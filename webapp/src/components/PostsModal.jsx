import { createPortal } from 'react-dom';

export default function PostsModal({ open, posts = [], onClose }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border p-4 rounded space-y-2 w-80 text-text"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-center">Ready-Made Posts</h3>
        {posts.map((p, i) => (
          <div
            key={i}
            className="flex items-start gap-2 border border-border p-2 rounded"
          >
            <textarea
              readOnly
              value={p}
              className="flex-1 text-xs bg-surface border-none resize-none"
            />
            <button
              onClick={() => navigator.clipboard.writeText(p)}
              className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded"
            >
              Copy
            </button>
          </div>
        ))}
        <button
          onClick={onClose}
          className="w-full px-4 py-1 bg-primary hover:bg-primary-hover rounded text-background"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
