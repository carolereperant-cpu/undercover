'use strict';

/** Puissance 4 : duel classique, 6 lignes, 7 colonnes, il faut aligner 4 jetons. */

const { ok, err, pick } = require('../common');

const ROWS = 6;
const COLS = 7;

const meta = {
  id: 'puissance4',
  label: 'Puissance 4',
  emoji: '🔴',
  tagline: 'Le duel classique : alignez 4 jetons.',
  min: 2,
  max: 2,
  minutes: '5',
  maxMinutes: 5,
  noGuests: true,
  rules: [
    'À tour de rôle, chacun laisse tomber un jeton dans une colonne.',
    'Le premier qui aligne 4 jetons (ligne, colonne ou diagonale) gagne.',
  ],
};

function init(room) {
  room.mg = {
    ids: room.players.map((p) => p.id),
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    turn: pick([0, 1]),
    winner: null, // 0 ou 1
    line: null,
    draw: false,
    phase: 'play',
  };
}

function findLine(board, row, col, who) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [[row, col]];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === who) {
        cells.push([r, c]);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  if (type !== 'drop') return err('Action inconnue.');
  if (mg.ids[mg.turn] !== actor.id) return err('Ce n’est pas ton tour.');
  const col = payload.col;
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return err('Colonne invalide.');
  let row = ROWS - 1;
  while (row >= 0 && mg.board[row][col] !== null) row--;
  if (row < 0) return err('Cette colonne est pleine.');
  mg.board[row][col] = mg.turn;
  const line = findLine(mg.board, row, col, mg.turn);
  if (line) {
    mg.winner = mg.turn;
    mg.line = line;
  } else if (mg.board[0].every((c) => c !== null)) {
    mg.draw = true;
  } else {
    mg.turn = 1 - mg.turn;
  }
  if (mg.winner !== null || mg.draw) {
    mg.phase = 'end';
    room.phase = 'end';
  }
  return ok();
}

function view(room, playerId) {
  const mg = room.mg;
  return {
    phase: mg.phase,
    ids: mg.ids,
    board: mg.board,
    turn: mg.turn,
    mine: mg.ids.indexOf(playerId),
    winner: mg.winner,
    line: mg.line,
    draw: mg.draw,
  };
}

module.exports = { meta, init, act, view };
