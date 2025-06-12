interface AdModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AdModal({ open, onClose }: AdModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-gray-800 p-4 rounded text-center space-y-4 w-64">
        <p className="text-yellow-400">Watch an ad every hour to get a free spin.</p>
        <button onClick={onClose} className="px-4 py-1 bg-blue-600 text-white rounded">
          Close
        </button>
      </div>
    </div>
  );
}
