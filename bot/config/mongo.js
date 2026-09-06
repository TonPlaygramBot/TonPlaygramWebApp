const integerSetting = (value, fallback, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

// Keep the driver's footprint predictable on small social-wall deployments.
// The MongoDB driver otherwise permits a much larger pool than this API needs.
export const mongoConnectionOptions = (env = process.env) => ({
  maxPoolSize: integerSetting(env.MONGO_MAX_POOL_SIZE, 10, 1),
  minPoolSize: integerSetting(env.MONGO_MIN_POOL_SIZE, 0),
  maxIdleTimeMS: integerSetting(env.MONGO_MAX_IDLE_TIME_MS, 60_000),
  serverSelectionTimeoutMS: integerSetting(env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10_000, 1),
  compressors: ['zlib'],
  zlibCompressionLevel: integerSetting(env.MONGO_ZLIB_COMPRESSION_LEVEL, 6, 0, 9)
});
