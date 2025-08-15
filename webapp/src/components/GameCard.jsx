import React from 'react';
import { Link } from 'react-router-dom';

export default function GameCard({ title, description, link, icon }) {
  let iconNode = null;
  if (icon) {
    iconNode =
      typeof icon === 'string'
        ? <img src={icon} alt="" className="h-8 w-8 mx-auto" />
        : React.isValidElement(icon)
          ? icon
          : <span className="text-3xl text-accent">{icon}</span>;
  }

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 shadow-lg space-y-2 text-center overflow-hidden wide-card">
      {iconNode}
      <h3
        className="text-lg font-bold text-yellow-400"
        style={{ WebkitTextStroke: '1px black' }}
      >
        {title}
      </h3>
      {description && <p className="text-subtext text-sm">{description}</p>}
      {link && (
        <Link
          to={link}
          className="inline-block mt-1 px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
        >
          Open
        </Link>
      )}
    </div>
  );
}
