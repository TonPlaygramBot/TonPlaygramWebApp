import React, { createContext, useCallback, useLayoutEffect, useReducer, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { registerAppBackHandler, resolveBackFallback } from '../utils/backNavigation.js';

export const BackNavigationContext = createContext(null);

/** One handler for all routes, shared by Telegram and the Android hardware key. */
export default function BackNavigationProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const overrides = useRef(new Map());
  const [, refresh] = useReducer((value) => value + 1, 0);
  const register = useCallback((key, routeKey, option) => {
    overrides.current.set(key, { routeKey, option });
    refresh();
    return () => {
      overrides.current.delete(key);
      refresh();
    };
  }, []);

  const current = useRef();
  current.current = { navigate, location };
  const getOverride = useCallback(() => {
    const entries = [...overrides.current.values()].reverse();
    return entries.find((entry) => entry.routeKey === current.current.location.key)?.option.current;
  }, []);
  const goBack = useCallback(() => {
    const { navigate, location } = current.current;
    const override = getOverride();
    if (typeof override === 'function') {
      override();
      return true;
    }
    // history.length can include external pages; use React Router's app index.
    if (Number(window.history.state?.idx) > 0) {
      navigate(-1);
      return true;
    }
    if (location.pathname === '/' && !override) return false;
    const fallback = typeof override === 'string' ? override : resolveBackFallback(location.pathname);
    if (`${location.pathname}${location.search}${location.hash}` !== fallback) {
      navigate(fallback, { replace: true });
      return true;
    }
    return false;
  }, [getOverride]);

  useLayoutEffect(() => registerAppBackHandler(goBack), [goBack]);
  useLayoutEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;
    tg.onEvent('backButtonClicked', goBack);
    return () => {
      tg.offEvent('backButtonClicked', goBack);
      tg.BackButton.hide();
    };
  }, [goBack]);
  useLayoutEffect(() => {
    const button = window.Telegram?.WebApp?.BackButton;
    if (!button) return;
    const visible = location.pathname !== '/' ||
      Number(window.history.state?.idx) > 0 || typeof getOverride() === 'function';
    if (visible) button.show();
    else button.hide();
  });

  return <BackNavigationContext.Provider value={register}>{children}</BackNavigationContext.Provider>;
}
