import type { Member, State } from "./engine.mjs";
export type Room = {
  id: string;
  host: string;
  mode: string;
  missionId: string;
  difficulty: string;
  phase: string;
  members: Record<
    string,
    Member & { ready: boolean; lastSeen: number; actionSeq: number }
  >;
  state: State | null;
  updatedAt: number;
  createdAt: number;
  revision: number;
};
export type Snapshot = {
  id: string;
  playerId: string;
  host: string;
  mode: string;
  missionId: string;
  difficulty: string;
  phase: string;
  members: (Member & { ready: boolean; connected: boolean })[];
  state: State | null;
  revision: number;
};
export const ROOM_TTL: number;
export function makeRoom(
  id: string,
  member: Member,
  options: {
    missionId: string;
    mode?: string;
    sport?: boolean;
    difficulty?: string;
  },
  now?: number,
): Room;
export function advanceRoom(room: Room, now: number): void;
export function applyRoom(
  room: Room,
  member: Member,
  action: string,
  payload?: Record<string, any>,
  now?: number,
): Room;
export function roomSnapshot(room: Room, playerId: string): Snapshot;
