import { useContext, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { BackNavigationContext } from '../components/BackNavigationProvider.jsx';

export default function useTelegramBackButton(onBackOrFallback) {
  const register = useContext(BackNavigationContext);
  const location = useLocation();
  const key = useRef(Symbol('page-back'));
  const option = useRef();
  option.current = typeof onBackOrFallback === 'string' ? onBackOrFallback.trim() : onBackOrFallback;
  const hasOverride = typeof option.current === 'function' || Boolean(option.current);
  useLayoutEffect(() => {
    if (!register || !hasOverride) return;
    return register(key.current, location.key, option);
  }, [register, hasOverride, location.key]);
}
