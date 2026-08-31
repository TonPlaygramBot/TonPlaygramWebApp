// A feed refresh can have started before an upload finished. Keep posts that
// this browser has just published until the server includes them in a newer
// snapshot, otherwise the older response makes a successful upload disappear.
export function reconcileWallPosts(remotePosts, currentPosts, pendingPostIds) {
  const remoteIds = new Set(remotePosts.map(post => post.id));
  remoteIds.forEach(id => pendingPostIds.delete(id));

  const pending = currentPosts.filter(post => pendingPostIds.has(post.id) && !remoteIds.has(post.id));
  return [...pending, ...remotePosts];
}
