'use client';

import { useState } from 'react';
import type { StakeTier, SeatsOption, JoinRoomPayload } from '../../shared/pokerTypes';
import { BRAND } from '../../lib/config';

const STAKES: StakeTier[] = [100, 500, 1000, 5000, 10000];
const SEATS: SeatsOption[] = [2, 4, 6, 9];

interface Props {
  onJoin: (p: JoinRoomPayload) => void;
}

export default function RoomSelector({ onJoin }: Props) {
  const [stake, setStake] = useState<StakeTier>(STAKES[0]);
  const [seats, setSeats] = useState<SeatsOption>(SEATS[0]);
  return (
    <div className="p-4 space-y-4 text-white" style={{ background: BRAND.panel }}>
      <div>
        <div className="mb-2">Stake</div>
        <select
          className="w-full p-2 rounded bg-transparent border border-[--gold]"
          style={{ '--gold': BRAND.gold } as any}
          value={stake}
          onChange={e => setStake(Number(e.target.value) as StakeTier)}
        >
          {STAKES.map(s => (
            <option key={s} value={s} className="text-black">
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="mb-2">Seats</div>
        <select
          className="w-full p-2 rounded bg-transparent border border-[--gold]"
          style={{ '--gold': BRAND.gold } as any}
          value={seats}
          onChange={e => setSeats(Number(e.target.value) as SeatsOption)}
        >
          {SEATS.map(s => (
            <option key={s} value={s} className="text-black">
              {s}
            </option>
          ))}
        </select>
      </div>
      <button
        className="w-full py-2 rounded bg-[--gold] text-black"
        style={{ '--gold': BRAND.gold } as any}
        onClick={() => onJoin({ stake, seats })}
      >
        Join Table
      </button>
    </div>
  );
}
