import { Apple, Check, Download, ShieldCheck, Smartphone } from 'lucide-react';

const configuredAndroidUrl = import.meta.env.VITE_ANDROID_APK_URL || import.meta.env.VITE_LAUNCHER_URL;
// The old cdn.tonplaygram.com hostname was never provisioned and sends Android
// users to Chrome's DNS error page. Keep the download on the web app's origin
// unless deployment explicitly supplies a working APK URL.
const androidUrl = configuredAndroidUrl?.includes('://cdn.tonplaygram.com/')
  ? '/tonplaygram-launcher.apk'
  : configuredAndroidUrl || '/tonplaygram-launcher.apk';
const iosUrl = import.meta.env.VITE_IOS_INSTALL_URL || '';

function StoreButton({ href, icon: Icon, eyebrow, title, download, unavailableLabel }) {
  const content = (
    <>
      <span className="native-app-download__icon" aria-hidden="true">
        <Icon size={22} strokeWidth={2.1} />
      </span>
      <span className="min-w-0 text-left">
        <span className="native-app-download__eyebrow">{eyebrow}</span>
        <strong className="native-app-download__button-title">
          {href ? title : unavailableLabel}
        </strong>
      </span>
      {href && <Download className="ml-auto shrink-0 opacity-70" size={18} aria-hidden="true" />}
    </>
  );

  if (!href) {
    return (
      <button type="button" className="native-app-download__button is-disabled" disabled>
        {content}
      </button>
    );
  }

  return (
    <a
      href={href}
      className="native-app-download__button"
      download={download || undefined}
      target={download ? undefined : '_blank'}
      rel={download ? undefined : 'noopener noreferrer'}
    >
      {content}
    </a>
  );
}

export default function NativeAppDownloadCard() {
  return (
    <section className="native-app-download" aria-labelledby="native-app-download-title">
      <div className="native-app-download__glow" aria-hidden="true" />
      <div className="native-app-download__header">
        <div className="native-app-download__badge">
          <Smartphone size={16} aria-hidden="true" />
          MOBILE APP
        </div>
        <h2 id="native-app-download-title">Take the whole arcade with you.</h2>
        <p>
          Install the full TonPlaygram prototype with the same account, wallet,
          social features and games you use here.
        </p>
      </div>

      <div className="native-app-download__buttons">
        <StoreButton
          href={androidUrl}
          icon={Smartphone}
          eyebrow="ANDROID"
          title="Download APK"
          unavailableLabel="APK coming soon"
          download="TonPlaygram.apk"
        />
        <StoreButton
          href={iosUrl}
          icon={Apple}
          eyebrow="IPHONE & IPAD"
          title="Install iOS app"
          unavailableLabel="iOS build coming soon"
        />
      </div>

      <div className="native-app-download__trust">
        <span><Check size={14} aria-hidden="true" /> Full app experience</span>
        <span><Check size={14} aria-hidden="true" /> Portrait optimized</span>
        <span><ShieldCheck size={14} aria-hidden="true" /> Official builds</span>
      </div>
      <p className="native-app-download__note">
        Android installs with an APK. Apple devices use a signed iOS install,
        TestFlight or the App Store—not an APK.
      </p>
    </section>
  );
}
