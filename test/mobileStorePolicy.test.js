import {
  blockExternalValueInMobileStore,
  isMobileStoreMode
} from '../bot/config/mobileStorePolicy.js';

describe('mobile store release policy', () => {
  test('recognizes explicit enabled and disabled values', () => {
    expect(isMobileStoreMode({ MOBILE_STORE_MODE: 'true' })).toBe(true);
    expect(isMobileStoreMode({ MOBILE_STORE_MODE: '1' })).toBe(true);
    expect(isMobileStoreMode({ MOBILE_STORE_MODE: 'false' })).toBe(false);
    expect(isMobileStoreMode({})).toBe(false);
  });

  test('blocks external-value routes in mobile store mode', () => {
    const previous = process.env.MOBILE_STORE_MODE;
    process.env.MOBILE_STORE_MODE = 'true';
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const next = jest.fn();

    blockExternalValueInMobileStore({}, { status, json }, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'mobile_store_free_play'
    }));
    expect(next).not.toHaveBeenCalled();
    if (previous === undefined) delete process.env.MOBILE_STORE_MODE;
    else process.env.MOBILE_STORE_MODE = previous;
  });
});
