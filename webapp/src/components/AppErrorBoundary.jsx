import React from 'react';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') {
      console.error('App crash:', error, info);
    }
  }

  resetApp = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch {}

    try {
      if (typeof caches !== 'undefined' && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {}

    window.location.reload();
  };

  render() {
    const { hasError } = this.state;
    if (!hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full bg-[#0c1020] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">We hit a loading issue</h1>
          <p className="text-sm text-white/80">
            If you see a blank screen in Chrome, the app may be using cached assets that no longer match
            the latest build. Tap below to reset the app data and reload.
          </p>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={this.resetApp}
              className="px-4 py-2 rounded-full bg-primary text-black font-semibold"
            >
              Reset & Reload
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full border border-white/40 text-white/90"
            >
              Just Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
