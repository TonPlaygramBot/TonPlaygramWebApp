import type { CityMapStatus } from './mapTypes';

export function GoogleMapCredits({ status }: { status: CityMapStatus }) {
  if (status.phase !== 'ready') return null;
  return (
    <aside className="ts-google-attribution" aria-label="Map attribution">
      <span className="ts-google-wordmark">Google Maps</span>
      <details>
        <summary>Data sources</summary>
        <div className="ts-google-sources">
          <strong>Surrounding city · Google Maps</strong>
          <p>{status.credits.join('; ') || 'Google Maps'}</p>
          <hr />
          <strong>Playable foreground · TonPlaygram</strong>
          <p>
            Original Blender buildings, characters, street furniture and shop.
            Street layout © OpenStreetMap contributors.
          </p>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap credits
          </a>
          <p>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google Privacy Policy
            </a>{' '}
            ·{' '}
            <a
              href="https://maps.google.com/help/terms_maps/"
              target="_blank"
              rel="noreferrer"
            >
              Google Maps terms
            </a>
          </p>
        </div>
      </details>
    </aside>
  );
}
