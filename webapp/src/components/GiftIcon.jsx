import React from 'react';

export default function GiftIcon({ icon, className }) {
  if (typeof icon === 'string' && icon.startsWith('/')) {
    if (icon.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
      return (
        <img
          src={icon}
          className={`${className || ''} object-contain`}
          alt=""
        />
      );
    }
  }
  return <span className={className}>{icon}</span>;
}
