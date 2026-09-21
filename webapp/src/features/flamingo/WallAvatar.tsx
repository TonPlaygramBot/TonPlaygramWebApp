import { useState } from 'react';
import { API_BASE_URL } from '../../utils/api.js';
import { wallAvatarUrl } from './wallIdentity';

export default function WallAvatar({
  name,
  src
}: {
  name: string;
  src?: string;
}) {
  const [failed, setFailed] = useState<string>();
  return src && failed !== src ? (
    <img
      className="fr-author-avatar"
      src={wallAvatarUrl(src, API_BASE_URL)}
      alt=""
      loading="lazy"
      onError={() => setFailed(src)}
    />
  ) : (
    <span className="fr-author-avatar" aria-label={`${name} avatar`}>
      {name
        .trim()
        .split(/\s+/)
        .map((word) => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?'}
    </span>
  );
}
