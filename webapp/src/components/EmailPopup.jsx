import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { createAccount } from '../utils/api.js';
import { socket } from '../utils/socket.js';

export default function EmailPopup({ open, onSave }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const handleSave = async () => {
    if (!email) return;
    setSaving(true);
    try {
      localStorage.setItem('email', email);
      const googleId = localStorage.getItem('googleId');
      const res = await createAccount(undefined, googleId, email);
      if (res?.accountId) {
        localStorage.setItem('accountId', res.accountId);
        socket.emit('register', { playerId: res.accountId });
      }
      if (res?.walletAddress) {
        localStorage.setItem('walletAddress', res.walletAddress);
      }
      onSave();
    } catch (err) {
      console.error('save email failed', err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="prism-box p-6 space-y-4 text-text w-80">
        <h3 className="text-lg font-bold text-center">Enter your email</h3>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded bg-background"
        />
        <button
          onClick={handleSave}
          disabled={!email || saving}
          className="w-full px-4 py-2 bg-primary hover:bg-primary-hover rounded text-white-shadow disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>,
    document.body
  );
}
