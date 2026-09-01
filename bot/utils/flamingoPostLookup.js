import path from 'path';

// Earlier deployments stored the complete API URL in the post while newer
// deployments store only the route. Looking up the post by one exact relative
// string loses its original filename, size and MIME type for those historical
// records. Those fields are needed to find a recovered disk/GridFS copy and to
// make mobile browsers accept the response as playable video.
export const wallMediaPostQuery = name => {
  const safeName = path.basename(String(name || ''));
  const encodedName = encodeURIComponent(safeName);
  const alternatives = [...new Set([safeName, encodedName])]
    .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return {
    $or: [
      { 'attachment.url': `/api/flamingo-wall/files/${safeName}` },
      { 'attachment.url': { $regex: new RegExp(`/api/flamingo-wall/files/(?:${alternatives.join('|')})(?:[?#].*)?$`, 'i') } }
    ]
  };
};
