import React from 'react';
import RoomSelector from './RoomSelector.jsx';
import TableSelector from './TableSelector.jsx';

export default function RoomPopup({
  open,
  selection,
  setSelection,
  onConfirm,
  tables,
  selectedTable,
  setSelectedTable,
}) {
  if (!open) return null;

  const disabled =
    !selection || !selection.token || !selection.amount || (tables && !selectedTable);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border p-6 rounded space-y-4 text-text w-80">
        <img

          src="/assets/icons/TonPlayGramLogo.webp"
          alt="TonPlaygram Logo"
          className="w-10 h-10 mx-auto"
        />
        <h3 className="text-lg font-bold text-center">Join a Room</h3>
        <p className="text-sm text-subtext text-center">Choose your token and amount</p>
        {tables && (
          <TableSelector
            tables={tables}
            selected={selectedTable}
            onSelect={setSelectedTable}
          />
        )}
        <RoomSelector
          selected={selection || { token: '', amount: 0 }}
          onSelect={setSelection}
          tokens={['TPC']}
        />
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded w-full disabled:opacity-50"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
