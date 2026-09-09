import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './gifts.css';
let locks = 0, previousOverflow = '';
export default function GiftDialog({ title = 'Gift atelier', children, onClose, busy = false, className = '' }) {
  const id = useId(), panel = useRef(null), closeRef = useRef(onClose), busyRef = useRef(busy);
  closeRef.current = onClose; busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement;
    if (locks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    panel.current?.querySelector('[data-dialog-close]')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busyRef.current) closeRef.current?.(); }
      if (event.key !== 'Tab') return;
      const items = [...(panel.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') || [])].filter(el => el.getClientRects().length);
      if (!items.length) { event.preventDefault(); panel.current?.focus(); return; }
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (event.shiftKey && (active === first || !items.includes(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !items.includes(active))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (--locks === 0) document.body.style.overflow = previousOverflow; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, []);
  return createPortal(<div className="gift-overlay" onClick={event => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} aria-busy={busy} className={`gift-dialog ${className}`}>
      <header className="gift-dialog-bar"><div className="gift-wordmark"><span aria-hidden="true">✦</span><div><span className="gift-eyebrow">TONPLAYGRAM</span><h2 id={id}>{title}</h2></div></div><button type="button" data-dialog-close className="gift-close" disabled={busy} onClick={onClose} aria-label="Close gift dialog">×</button></header>
      {children}
    </section>
  </div>, document.body);
}
