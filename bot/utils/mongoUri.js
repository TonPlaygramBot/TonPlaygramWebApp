export function getMongoUri() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL;
  if (uri) {
    process.env.MONGODB_URI = uri;
  }
  return uri;
}
