function playerRoom(id) {
  return `player:${id}`;
}

export function initOrchestratorSocket(io, orchestrator) {
  io.on('connection', (socket) => {
    const { playerId } = socket.handshake.auth || {};
    if (playerId) {
      socket.join(playerRoom(playerId));
    }

    socket.on('match:move', ({ matchId, move }, cb) => {
      const pid = playerId;
      const res = orchestrator.submitMove(matchId, pid, move);
      const event = res.error ? 'move.rejected' : 'move.accepted';
      socket.emit(event, { matchId, move, error: res.error });
      cb && cb(res);
    });

    socket.on('match:rejoin', ({ matchId }) => {
      if (playerId) orchestrator.rejoinMatch(matchId, playerId);
    });
  });

  orchestrator.on('match_ready', (match) => {
    for (const p of match.players) {
      io.to(playerRoom(p.id)).emit('match_ready', {
        matchId: match.id,
        gameId: match.gameId,
        players: match.players.map((pl) => pl.id)
      });
    }
  });

  orchestrator.on('match_started', (match) => {
    for (const p of match.players) {
      io.to(playerRoom(p.id)).emit('match_started', { matchId: match.id });
    }
  });

  orchestrator.on('move', ({ match, playerId, move }) => {
    for (const p of match.players) {
      io.to(playerRoom(p.id)).emit('state', {
        matchId: match.id,
        turn: match.turn,
        lastMove: { playerId, move }
      });
    }
  });

  orchestrator.on('timer', ({ matchId, playerId, remaining }) => {
    io.to(playerRoom(playerId)).emit('timer.tick', {
      matchId,
      remaining
    });
  });

  orchestrator.on('match_ended', (match) => {
    for (const p of match.players) {
      io.to(playerRoom(p.id)).emit('match_end', {
        matchId: match.id,
        winner: match.winner,
        reason: match.reason
      });
    }
  });
}
