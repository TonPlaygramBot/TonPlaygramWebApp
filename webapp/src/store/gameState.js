import { createContext, useContext, useState } from 'react';
import { SnakeGame } from '../../bot/logic/snakeGame.js';

const GameContext = createContext(null);

export function GameProvider({ board = {}, children }) {
  const [state, setState] = useState({
    game: new SnakeGame(board),
    last: null,
  });

  const dispatch = (action) => {
    let result = null;
    setState((s) => {
      const next = { ...s };
      switch (action.type) {
        case 'INIT':
          next.game = new SnakeGame(action.board);
          next.last = null;
          break;
        case 'ADD_PLAYER':
          next.game.addPlayer(action.id, action.name);
          break;
        case 'ROLL':
          result = next.game.rollDice(action.dice);
          next.last = result;
          break;
        default:
          break;
      }
      return { ...next };
    });
    return result;
  };

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
