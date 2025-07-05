import { API_BASE_URL } from './api.js';

export function getLudoLobbies() {
  return fetch(API_BASE_URL + '/api/ludo/lobbies').then((r) => r.json());
}

export function getLudoLobby(id) {
  return fetch(API_BASE_URL + '/api/ludo/lobby/' + id).then((r) => r.json());
}

export function getLudoBoard(id) {
  return fetch(API_BASE_URL + '/api/ludo/board/' + id).then((r) => r.json());
}

export function rollDice(id) {
  return fetch(API_BASE_URL + '/api/ludo/roll/' + id, { method: 'POST' }).then((r) => r.json());
}

export function moveToken(id, token) {
  return fetch(API_BASE_URL + '/api/ludo/move/' + id, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  }).then((r) => r.json());
}

export function endTurn(id) {
  return fetch(API_BASE_URL + '/api/ludo/end/' + id, { method: 'POST' }).then((r) => r.json());
}
