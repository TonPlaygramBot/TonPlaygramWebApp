import React from 'react';
import { useSecureAuth } from '../hooks/useSecureAuth.js';
import UnlockModal from './UnlockModal.jsx';

export default function ProtectedRoute({ children }) {
  const { authenticated } = useSecureAuth();

  return (
    <>
      {!authenticated && <UnlockModal open={!authenticated} />}
      {authenticated && children}
    </>
  );
}
