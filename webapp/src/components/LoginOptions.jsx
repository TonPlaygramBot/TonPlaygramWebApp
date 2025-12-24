import React, { useEffect } from 'react';
import { provisionAccount } from '../utils/account.js';

export default function LoginOptions() {
  useEffect(() => {
    (async () => {
      const alreadyProvisioned = localStorage.getItem('accountProvisioned') === 'true';
      try {
        await provisionAccount({ googleId: localStorage.getItem('googleId') });
        if (!alreadyProvisioned) {
          window.location.reload();
        }
      } catch (err) {
        console.error('Account setup failed', err);
      }
    })();
  }, []);

  return (
    <div className="p-4 text-text">
      <p>Loading...</p>
    </div>
  );
}
