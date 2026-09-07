let appBackHandler;

export function registerAppBackHandler(handler) {
  appBackHandler = handler;
  return () => {
    if (appBackHandler === handler) appBackHandler = undefined;
  };
}

// undefined means React has not mounted; false means the app is at its root.
export function dispatchAppBack() {
  return appBackHandler?.();
}

export function resolveBackFallback(pathname) {
  if (pathname.startsWith('/wall/profile/')) return '/wall';
  if (pathname === '/games/transactions') return '/games';
  if (pathname.startsWith('/games/')) {
    const [, , game, section] = pathname.split('/');
    return section === 'lobby' ? '/games' : `/games/${game}/lobby`;
  }
  return '/';
}

export function handleNativeBack({ canGoBack, appResult, notifyListeners, history, exit }) {
  if (appResult === true) return;
  if (appResult === false) {
    exit();
    return;
  }
  if (notifyListeners()) return;
  if (canGoBack) history.back();
  else exit();
}
