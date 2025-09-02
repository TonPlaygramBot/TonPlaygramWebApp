import React, { useEffect } from 'react';
import { ensureAccountId } from '../utils/telegram.js';

export default function LoginOptions() {
  useEffect(() => {
    (async () => {
      const accountId = await ensureAccountId();
      if (accountId) {
        localStorage.setItem('accountId', accountId);
      }
    })();
  }, []);

  return (
    <div className="p-4 text-text">
      <p>Loading...</p>
    </div>
  );
}
