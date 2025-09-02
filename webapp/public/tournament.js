(function(){
  function nextPow2(n){ let p=1; while(p<n) p<<=1; return p; }

  function createTournament(players){
    const N = players.length;
    const pow2 = nextPow2(N);
    const seeded = players.slice();
    for(let i=N;i<pow2;i++) seeded.push({ name:'BYE', flag:'' });
    const rounds = [];
    let current = seeded.map((_,i)=>i);
    while(current.length>1){
      const round=[];
      for(let i=0;i<current.length;i+=2){
        round.push({ p1: current[i], p2: current[i+1], winner:null });
      }
      rounds.push(round);
      current = round.map(()=>null);
    }
    const state = { players: seeded, rounds, userIndex:0, finished:false, champion:null };
    autoAdvanceByes(state);
    return state;
  }

  function propagateWinner(state, r, m, winner){
    const match = state.rounds[r][m];
    match.winner = winner;
    if(r+1 < state.rounds.length){
      const next = state.rounds[r+1][Math.floor(m/2)];
      if(m%2===0) next.p1 = winner; else next.p2 = winner;
    } else {
      state.champion = winner;
      state.finished = true;
    }
  }

  function autoAdvanceByes(state){
    for(let r=0;r<state.rounds.length;r++){
      for(let m=0;m<state.rounds[r].length;m++){
        const match = state.rounds[r][m];
        if(match.winner!==null) continue;
        const p1 = state.players[match.p1];
        const p2 = state.players[match.p2];
        if(p1.name==='BYE' && p2.name==='BYE'){
          propagateWinner(state,r,m,match.p1);
        } else if(p1.name==='BYE'){
          propagateWinner(state,r,m,match.p2);
        } else if(p2.name==='BYE'){
          propagateWinner(state,r,m,match.p1);
        }
      }
    }
  }

  function getNextUserMatch(state){
    const u = state.userIndex;
    for(let r=0;r<state.rounds.length;r++){
      for(let m=0;m<state.rounds[r].length;m++){
        const match = state.rounds[r][m];
        if(match.winner!==null) continue;
        if(match.p1===u || match.p2===u){
          const p1 = state.players[match.p1];
          const p2 = state.players[match.p2];
          if(p1.name==='BYE' || p2.name==='BYE'){
            const winner = p1.name==='BYE'? match.p2 : match.p1;
            propagateWinner(state,r,m,winner);
            return getNextUserMatch(state);
          }
          return { round:r, match:m };
        }
      }
    }
    return null;
  }

  function simulateRound(state,r){
    for(let m=0;m<state.rounds[r].length;m++){
      const match = state.rounds[r][m];
      if(match.winner!==null) continue;
      if(match.p1===state.userIndex || match.p2===state.userIndex) continue;
      const winner = Math.random()<0.5 ? match.p1 : match.p2;
      propagateWinner(state,r,m,winner);
    }
  }

  function simulateRemaining(state,startRound){
    for(let r=startRound;r<state.rounds.length;r++){
      simulateRound(state,r);
    }
  }

  function save(state){ sessionStorage.setItem('pollroyaleTournament', JSON.stringify(state)); }
  function load(){ const s=sessionStorage.getItem('pollroyaleTournament'); return s? JSON.parse(s):null; }

  window.Tournament = { createTournament, getNextUserMatch, simulateRound, simulateRemaining, save, load, propagateWinner };
})();
