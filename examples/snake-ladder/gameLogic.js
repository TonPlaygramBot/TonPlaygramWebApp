export const BOARD_SIZE = 100;
export const DEFAULT_OPTIONS = {
  boardTheme: 'classic',
  moveSpeed: 'normal'
};
export const WEAPONS = ['Pistol', 'Shotgun', 'Rifle', 'SMG'];

export const DEFAULT_SNAKES = {
  16: 6,
  48: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78
};

export const DEFAULT_LADDERS = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100
};

export class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.options = { ...DEFAULT_OPTIONS };
    this.resetBoard();
  }

  resetBoard() {
    this.players = [];
    this.currentPlayer = 0;
    this.diceRoll = null;
    this.snakes = { ...DEFAULT_SNAKES };
    this.ladders = { ...DEFAULT_LADDERS };
    this.winner = null;
    this.ai = {
      id: 'AI_BOT',
      name: 'AI Bot',
      position: 0,
      inventory: [...WEAPONS],
      equippedWeapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)]
    };
  }

  addPlayer(id, name) {
    if (this.players.length >= 4) return null;
    const existing = this.players.find((p) => p.id === id);
    if (existing) return existing;
    const player = {
      id,
      name,
      position: 0,
      inventory: ['Pistol'],
      equippedWeapon: 'Pistol'
    };
    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    const index = this.players.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.players.splice(index, 1);
    if (this.players.length === 0) {
      this.currentPlayer = 0;
      this.winner = null;
    } else {
      if (this.currentPlayer >= this.players.length) {
        this.currentPlayer = 0;
      }
      if (this.winner === id) {
        this.winner = null;
      }
    }
    return true;
  }

  rollDice(playerId) {
    if (this.winner) return;
    const current = this.players[this.currentPlayer];
    if (!current || current.id !== playerId) return;
    const value = Math.floor(Math.random() * 6) + 1;
    this.diceRoll = value;
    let newPos = current.position + value;
    if (newPos > BOARD_SIZE) newPos = current.position;
    newPos = this.snakes[newPos] || this.ladders[newPos] || newPos;
    current.position = newPos;
    if (newPos === BOARD_SIZE) {
      this.winner = current.id;
    } else {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    }
  }

  setOption(key, value) {
    if (!(key in this.options)) return false;
    this.options[key] = value;
    return true;
  }

  swapWeapon(playerId, weapon) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return false;
    if (!player.inventory.includes(weapon)) return false;
    player.equippedWeapon = weapon;
    return true;
  }

  getState() {
    return {
      roomId: this.roomId,
      players: this.players,
      ai: this.ai,
      currentPlayer: this.currentPlayer,
      diceRoll: this.diceRoll,
      snakes: this.snakes,
      ladders: this.ladders,
      winner: this.winner,
      options: this.options,
      weapons: WEAPONS
    };
  }
}
