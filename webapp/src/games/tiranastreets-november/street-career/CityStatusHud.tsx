import { Heart, Shield } from 'lucide-react';

type CityStatusHudProps = {
  health: number;
  armor: number;
  maxArmor: number;
  cash: number;
  pursuit: number;
};

export function CityStatusHud({ health, armor, maxArmor, cash, pursuit }: CityStatusHudProps) {
  const life = Math.max(0, Math.min(100, Math.ceil(health)));
  const armorCapacity = Math.max(1, Math.ceil(maxArmor));
  const protection = Math.max(0, Math.min(armorCapacity, Math.ceil(armor)));
  const stars = Math.max(0, Math.min(5, Math.trunc(pursuit)));
  return (
    <aside className="tsc-city-status" aria-label="Player status">
      <div className="tsc-vitals" aria-label="Health and armor">
        <div className={'tsc-vital health' + (life <= 25 ? ' is-critical' : '')}>
          <Heart size={13} aria-hidden="true" />
          <meter min={0} max={100} value={life} aria-label="Health" />
          <span aria-hidden="true">{life}</span>
        </div>
        <div className="tsc-vital armor">
          <Shield size={13} aria-hidden="true" />
          <meter min={0} max={armorCapacity} value={protection} aria-label="Armor" />
          <span aria-hidden="true">{protection}</span>
        </div>
      </div>
      <div className="tsc-city-wallet" aria-label="Street cash and pursuit">
        <strong aria-label={'Street cash: ' + cash.toLocaleString('en-US')}>${cash.toLocaleString('en-US')}</strong>
        {stars > 0 && <span className="tsc-pursuit" aria-label={`Pursuit level ${stars} of 5`}>{'★'.repeat(stars)}<i aria-hidden="true">{'☆'.repeat(5-stars)}</i></span>}
      </div>
    </aside>
  );
}
