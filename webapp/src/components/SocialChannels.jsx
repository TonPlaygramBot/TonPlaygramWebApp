import { FaFacebookF, FaInstagram, FaTelegramPlane, FaTiktok, FaYoutube } from 'react-icons/fa';
import { FiArrowUpRight } from 'react-icons/fi';
import { SOCIAL_CHANNELS } from '../config/socialChannels.js';

const ICONS = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  telegram: FaTelegramPlane,
  tiktok: FaTiktok,
  youtube: FaYoutube
};

export default function SocialChannels({ variant = 'card' }) {
  const isHero = variant === 'hero';

  return (
    <section
      aria-labelledby={`official-channels-title-${variant}`}
      className={isHero
        ? 'home-intro__channels'
        : 'overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-cyan-950/70 p-4 shadow-[0_18px_50px_rgba(0,0,0,.25)]'}
    >
      <div className={isHero ? 'mb-3 flex items-end justify-between gap-3' : 'mb-4 flex items-end justify-between gap-3'}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">Stay connected</p>
          <h4 id={`official-channels-title-${variant}`} className="mt-1 text-base font-bold text-white">Official TonPlayGram channels</h4>
          {!isHero && <p className="mt-1 text-xs leading-5 text-slate-300">Follow launches, community news and fresh reward tasks.</p>}
        </div>
        {!isHero && <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-100">6 channels</span>}
      </div>

      <div className={isHero ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2 sm:grid-cols-3'}>
        {SOCIAL_CHANNELS.map((channel) => {
          const Icon = ICONS[channel.id];
          return (
            <a
              key={channel.id}
              href={channel.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Open TonPlaygram on ${channel.name}`}
              className={`group relative min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] transition active:scale-[0.98] hover:border-white/25 hover:bg-white/10 ${isHero ? 'p-2.5' : 'p-3'}`}
            >
              <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${channel.accent}`} />
              <div className="flex items-center justify-between gap-2">
                <span className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${channel.accent} font-black text-white shadow-lg ${isHero ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-base'}`}>
                  {Icon ? <Icon aria-hidden="true" /> : 'X'}
                </span>
                <FiArrowUpRight className="text-slate-500 transition group-hover:text-white" aria-hidden="true" />
              </div>
              <p className={`${isHero ? 'mt-1.5 text-xs' : 'mt-2 text-sm'} truncate font-bold text-white`}>{channel.name}</p>
              {!isHero && <p className="truncate text-[10px] text-slate-400">{channel.handle}</p>}
            </a>
          );
        })}
      </div>
    </section>
  );
}
