import React from 'react';
import { createPortal } from 'react-dom';

export default function DevNotifyModal({
  open,
  onClose,
  notifyText,
  setNotifyText,
  notifyPhoto,
  setNotifyPhoto,
  notifySending,
  onSend
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded text-center space-y-4 text-text w-80">
        <h3 className="text-lg font-bold">Send Notification</h3>
        <textarea
          placeholder="Message"
          value={notifyText}
          onChange={(e) => setNotifyText(e.target.value)}
          className="border p-1 rounded w-full h-40 text-black"
        />
        {notifyPhoto && (
          <img src={notifyPhoto} alt="preview" className="max-h-40 mx-auto" />
        )}
        <div className="flex space-x-2">
          <label className="flex-1 px-4 py-1 border border-border bg-surface rounded cursor-pointer text-center">
            Upload Image
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setNotifyPhoto(reader.result);
                reader.readAsDataURL(file);
              }}
              className="hidden"
            />
          </label>
          <button
            onClick={onSend}
            disabled={notifySending}
            className="flex-1 px-4 py-1 bg-primary hover:bg-primary-hover rounded text-background disabled:opacity-50"
          >
            {notifySending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <button onClick={onClose} className="px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded w-full">
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
