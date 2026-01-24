import { useState } from 'react';

export default function OptionIcon({ src, alt, fallback, className = '' }) {
  const [failed, setFailed] = useState(false);
  const showFallback = failed || !src;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {!showFallback ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <span className="text-lg">{fallback}</span>
      )}
    </div>
  );
}
