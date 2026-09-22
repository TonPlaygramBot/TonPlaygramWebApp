export const isDatabaseQuotaError = (error) =>
  /space quota|exceeded.*storage|limit=storage|quota.*(?:exceed|full)/i.test(
    String(error?.message || error || '')
  );

export function flamingoUploadFailure(error) {
  if (error?.code === 'WALL_STORAGE_BUSY')
    return {
      status: 503,
      code: error.code,
      retryable: true,
      error: error.message
    };
  if (String(error?.code || '').startsWith('WALL_OBJECT_STORAGE_'))
    return {
      status: error.status || 503,
      code: error.code,
      retryable: error.retryable === true,
      error: error.message
    };
  if (error?.code === 'WALL_STORAGE_NOT_DURABLE')
    return {
      status: 503,
      code: error.code,
      retryable: false,
      error: error.message
    };
  if (isDatabaseQuotaError(error))
    return {
      status: 507,
      code: 'WALL_DATABASE_QUOTA',
      retryable: false,
      error:
        'The post database is full. Your selection is kept; database storage needs to be restored before publishing.'
    };
  if (['ENOSPC', 'EDQUOT', 'WALL_DISK_FULL'].includes(error?.code))
    return {
      status: 507,
      code: 'WALL_DISK_FULL',
      retryable: false,
      error:
        'The server media storage is full. Your video is kept; server storage must be freed or expanded before retrying.'
    };
  if (['EACCES', 'EROFS'].includes(error?.code))
    return {
      status: 503,
      code: 'WALL_STORAGE_UNAVAILABLE',
      retryable: false,
      error:
        'Media storage is unavailable. Your selection is kept; please try again later.'
    };
  if (error?.code === 'ENOENT')
    return {
      status: 404,
      error: 'Upload session not found. Tap Publish to restart it.'
    };
  return {
    status: error?.status || 500,
    error: error?.status
      ? error.message
      : 'Publishing failed. Your selection is kept; please retry.'
  };
}
