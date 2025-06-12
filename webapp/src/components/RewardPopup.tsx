interface RewardPopupProps {
  reward: number | null;
  onClose: () => void;
}

export default function RewardPopup({ reward, onClose }: RewardPopupProps) {
  if (reward === null) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-gray-800 p-6 rounded text-center space-y-4">
        <div className="text-yellow-400 text-3xl">+{reward} TPC</div>
        <button
          onClick={onClose}
          className="px-4 py-1 bg-blue-600 text-white rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}
