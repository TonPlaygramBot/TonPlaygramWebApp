import type {
  BowlingState,
  ThrowInput
} from '../../../../shared/bowling/engine';
export type Launch = {
  mode: 'ai' | 'online';
  difficulty: number;
  tableId?: string;
};
export type RoomSnapshot = {
  tableId: string;
  seat: number;
  state: BowlingState;
  revision: number;
  joined: boolean;
  connected: boolean[];
  turnRemaining: number;
  stake: number;
  settlement: null | {
    status: 'pending' | 'finished' | 'refunded';
    winner?: string | null;
    amount?: number;
    reason?: string;
  };
};
export type BowlingServices = {
  join: (id: string) => Promise<RoomSnapshot>;
  sync: (id: string) => Promise<RoomSnapshot>;
  bowl: (id: string, turn: number, input: ThrowInput) => Promise<RoomSnapshot>;
  leave: (id: string) => Promise<RoomSnapshot>;
};
