import {
  MISSIONS,
  MAX_PLAYERS,
  createState,
  upgradeState,
  addPlayer,
  removePlayer,
  control,
  interact,
  advanceState,
  publicState,
} from "./engine.mjs";

export const ROOM_TTL = 30 * 60 * 1000;
export function makeRoom(
  id,
  member,
  { missionId, mode = "rivals", sport = false, difficulty = "normal" } = {},
  now = Date.now(),
) {
  if (!["rivals", "coop", "career"].includes(mode))
    throw Error("Choose a supported city mode.");
  if (!MISSIONS.some((m) => m.id === missionId))
    throw Error("Choose a mission.");
  return {
    id,
    host: member.id,
    mode,
    missionId,
    difficulty: ["easy", "normal", "hard"].includes(difficulty)
      ? difficulty
      : "normal",
    phase: mode === "career" ? "active" : "waiting",
    members: {
      [member.id]: { ...member, ready: true, lastSeen: now, actionSeq: 0 },
    },
    state:
      mode === "career"
        ? createState([member], missionId, "career", sport, difficulty)
        : null,
    updatedAt: now,
    createdAt: now,
    revision: 0,
  };
}
export function advanceRoom(room, now) {
  if(room.state)upgradeState(room.state);
  now = Math.max(now, room.updatedAt);
  const seconds = Math.max(0, (now - room.updatedAt) / 1000);
  if (room.state && room.phase === "active") {
    // Long suspension never replays held acceleration. The mission deadline still advances.
    if (seconds > 2) {
      room.state.elapsed += seconds - 2;
      for (const p of Object.values(room.state.players)) p.inputAt = -10;
    }
    advanceState(room.state, Math.min(seconds, 2));
    if (room.state.phase === "finished") room.phase = "finished";
  }
  room.updatedAt = now;
  for (const m of Object.values(room.members)) {
    if (now - m.lastSeen > 45_000 && room.mode !== "career") {
      delete room.members[m.id];
      if (room.state) removePlayer(room.state, m.id);
    }
  }
  if (!room.members[room.host]) room.host = Object.keys(room.members)[0] || "";
  if (!room.host) room.phase = "closed";
}
export function applyRoom(
  room,
  member,
  action,
  payload = {},
  now = Date.now(),
) {
  now = Math.max(now, room.updatedAt);
  if (now - room.updatedAt > ROOM_TTL)
    throw Error("This room expired. Create a new city room.");
  advanceRoom(room, now);
  if (action === "join") {
    if (room.mode === "career" && !room.members[member.id])
      throw Error("This is a private career session.");
    if (!room.members[member.id]) {
      if (room.phase !== "waiting")
        throw Error("This crew has already started.");
      if (Object.keys(room.members).length >= MAX_PLAYERS)
        throw Error("This city room is full.");
      room.members[member.id] = {
        ...member,
        ready: false,
        lastSeen: now,
        actionSeq: 0,
      };
    }
    // A resumed browser starts a new input stream for its own seat only.
    if (room.state?.players[member.id]) {
      room.state.players[member.id].input.seq = 0;
      room.state.players[member.id].inputAt = -10;
    }
    room.members[member.id].actionSeq = 0;
  }
  const seat = room.members[member.id];
  if (!seat) throw Error("Rejoin the room to continue.");
  seat.lastSeen = now;
  if (action === "leave") {
    delete room.members[member.id];
    if (room.state) removePlayer(room.state, member.id);
    if (room.host === member.id) room.host = Object.keys(room.members)[0] || "";
    if (!room.host) room.phase = "closed";
  } else if (action === "ready") {
    if (room.phase !== "waiting") throw Error("The run has already started.");
    seat.ready = payload.ready === true;
  } else if (action === "start") {
    if (room.host !== member.id) throw Error("The host starts the run.");
    if (room.phase !== "waiting") throw Error("The run has already started.");
    if (Object.keys(room.members).length < 2)
      throw Error("Invite one more player to start online.");
    if (!Object.values(room.members).every((m) => m.ready))
      throw Error("Wait for the crew to get ready.");
    room.state = createState(
      Object.values(room.members),
      room.missionId,
      room.mode,
      false,
      room.difficulty,
    );
    room.phase = "active";
  } else if (action === "input") {
    if (room.state && room.phase === "active") {
      control(room.state, member.id, payload.input);
      if (
        Number.isSafeInteger(payload.actionSeq) &&
        payload.actionSeq > seat.actionSeq
      ) {
        seat.actionSeq = payload.actionSeq;
        if (typeof payload.action === "string" && payload.action.length <= 80)
          interact(room.state, member.id, payload.action);
      }
    }
  } else if (!["join", "poll"].includes(action))
    throw Error("Unknown room action.");
  room.revision++;
  return room;
}
export function roomSnapshot(room, playerId) {
  return {
    id: room.id,
    playerId,
    host: room.host,
    mode: room.mode,
    missionId: room.missionId,
    difficulty: room.difficulty,
    phase: room.phase,
    members: Object.values(room.members).map(
      ({ id, name, ready, lastSeen }) => ({
        id,
        name,
        ready,
        connected: room.updatedAt - lastSeen < 10_000,
      }),
    ),
    state: room.state ? publicState(room.state) : null,
    revision: room.revision,
  };
}
