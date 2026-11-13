export type OnlinePlayer = {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  ammo: number;
  reserve: number;
  weapon: 'ar' | 'smg';
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  medkits: number;
  reload: number;
  respawn: number;
  protection: number;
  crouch: boolean;
  shotSerial: number;
  connected: boolean;
  forfeited: boolean;
};
export type OnlineState = {
  rule?:'last-stand'|'deathmatch';
  alive?:number;
  tableId: string;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  startsAt: number;
  serverNow: number;
  stake: number;
  elapsed: number;
  limit: number;
  killLimit: number;
  players: OnlinePlayer[];
  winnerAccountId: string;
  reason: string;
  settlement: null | {
    status: string;
    winnerAccountId?: string;
    amount?: number;
    reason?: string;
  };
};
export type OnlineTransport = {
  playerId: string;
  send: (input: Record<string, number | boolean>) => void;
};
