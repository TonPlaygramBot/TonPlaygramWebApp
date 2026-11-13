/** Direct HTTPS broadcasts; never proxy, download or cache a live programme.
 * Broadcaster pages and stream audit notes: docs/tirana-camera-radio-upgrade.md. */
export const ALBANIAN_STATIONS = [
  { id: 'top-albania', name: 'Top Albania Radio', genre: 'Hits · Shows', stream: 'https://live.top-media.al/tar', website: 'https://www.topalbaniaradio.com/live/tar/' },
  { id: 'club-fm', name: 'Club FM', genre: 'Hits · Dance', stream: 'https://cp1.sednastream.com/proxy/clubfm?mp=/stream', website: 'https://clubfm.al/radiochannel/live-clubfm/' },
  { id: 'top-gold', name: 'Top Gold', genre: 'Classics · Rock', stream: 'https://live.topgold.al/topgold', website: 'https://www.topalbaniaradio.com/live/topgold/' },
  { id: 'my-music', name: 'My Music Radio', genre: 'Muzikë shqip', stream: 'https://live.top-media.al/mmr', website: 'https://www.topalbaniaradio.com/live/mmr/' },
  { id: 'radio-shqip', name: 'Radio Shqip', genre: 'Muzikë shqip', stream: 'https://cp1.sednastream.com/proxy/radioshqip?mp=/stream', website: 'https://clubfm.al/radiochannel/radio-shqip/' }
] as const;
export type RadioStation = typeof ALBANIAN_STATIONS[number];
