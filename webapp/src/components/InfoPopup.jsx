import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
export default function InfoPopup({open,onClose,title,info,children,widthClass='w-11/12 max-w-sm sm:w-96'}) {
  const id=useId(),panel=useRef(null),closeButton=useRef(null);
  useEffect(()=>{if(!open)return;const previous=document.activeElement;closeButton.current?.focus();return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[open]);
  if(!open)return null;
  const handleKey=event=>{
    if(event.defaultPrevented)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose?.();}
    if(event.key!=='Tab')return;
    const items=[...(panel.current?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[])].filter(el=>el.getClientRects().length);
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  return createPortal(<div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-70 overflow-y-auto py-4" style={{paddingTop:'max(1rem, env(safe-area-inset-top))',paddingBottom:'max(1rem, env(safe-area-inset-bottom))'}}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={title?id:undefined} aria-label={title?undefined:'Information'} onKeyDown={handleKey} className={`prism-box flex-col p-6 space-y-4 text-text relative ${widthClass}`} style={{maxWidth:'calc(100vw - 2rem)',maxHeight:'calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))',overflowY:'auto',overscrollBehavior:'contain',overflowWrap:'anywhere'}}>
      {title&&<h3 id={id} className="text-lg font-bold text-center">{title}</h3>}{info&&<p className="text-sm text-subtext text-center">{info}</p>}{children}<button type="button" ref={closeButton} onClick={onClose} className="mx-auto block min-h-[44px] px-5 py-2 bg-primary hover:bg-primary-hover rounded text-white-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">Close</button>
    </div>
  </div>,document.body);
}
