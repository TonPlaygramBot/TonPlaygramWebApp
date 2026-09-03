const ANTAR_KOMITETI_AUTHOR = /^\s*antar\s+komiteti\s*[.!]?\s*$/i;
const REMOVAL_LIMIT = 2;

// This migration deliberately uses the already-connected Mongoose model. It
// must never open another connection or replace MONGO_URI: wall documents and
// their media lookup stay on the same production database/configuration.
export async function removeAntarKomitetiPosts(PostModel) {
  const posts = await PostModel.find({ author: ANTAR_KOMITETI_AUTHOR })
    .sort({ createdAt: -1 })
    .limit(REMOVAL_LIMIT)
    .select('_id')
    .lean();
  if (!posts.length) return 0;
  const result = await PostModel.deleteMany({ _id: { $in: posts.map(post => post._id) } });
  return result.deletedCount || 0;
}

export { ANTAR_KOMITETI_AUTHOR, REMOVAL_LIMIT };
