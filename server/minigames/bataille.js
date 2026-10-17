'use strict';

/**
 * Bataille navale : grille 10 x 10, 5 bateaux (5, 4, 3, 3, 2 cases), placés au hasard.
 * Chacun peut re-mélanger sa flotte avant de valider. Le serveur ne révèle jamais les bateaux adverses
 * avant qu'ils soient coulés (ou la fin de la partie).
 */

const { ok, err, pick, shuffle } = require('../common');

const SIZE = 10;
const FLEET = [5, 4, 3, 3, 2];

const meta = {
  id: 'bataille',
  label: 'Bataille navale',
  emoji: '🚢',
  tagline: 'Coulez la flotte de votre adversaire.',
  min: 2,
  max: 2,
  minutes: '10 à 15',
  maxMinutes: 15,
  noGuests: true,
  rules: [
    'Chacun a 5 bateaux cachés sur une grille de 10 x 10. Ils sont placés au hasard, tu peux les re-mélanger.',
    'À tour de rôle, tirez sur une case de la grille adverse : touché, raté ou coulé.',
    'Le premier qui coule toute la flotte adverse gagne.',
  ],
};

/** Place la flotte au hasard : chaque bateau est une liste de cases [ligne, colonne]. */
function randomFleet() {
  const taken = new Set();
  const ships = [];
  for (const length of FLEET) {
    for (;;) {
      const horizontal = pick([true, false]);
      const r = pick([...Array(horizontal ? SIZE : SIZE - length + 1).keys()]);
      const c = pick([...Array(horizontal ? SIZE - length + 1 : SIZE).keys()]);
      const cells = Array.from({ length }, (_, i) => (horizontal ? [r, c + i] : [r + i, c]));
      if (cells.some(([rr, cc]) => taken.has(`${rr},${cc}`))) continue;
      cells.forEach(([rr, cc]) => taken.add(`${rr},${cc}`));
      ships.push(cells);
      break;
    }
  }
  return ships;
}

const emptyGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

function init(room) {
  const ids = room.players.map((p) => p.id);
  room.mg = {
    ids,
    phase: 'place',
    boards: Object.fromEntries(ids.map((id) => [id, { ships: randomFleet(), shots: emptyGrid() }])),
    ready: {},
    turn: null,
    winner: null,
    lastShot: null,
  };
}

const isSunk = (board, ship) => ship.every(([r, c]) => board.shots[r][c] === 'hit');

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const me = mg.boards[actor.id];
  if (!me) return err('Tu ne fais pas partie de cette partie.');
  const enemyId = mg.ids.find((id) => id !== actor.id);

  if (type === 'shuffle') {
    if (mg.phase !== 'place' || mg.ready[actor.id]) return err('Trop tard pour changer ta flotte.');
    me.ships = randomFleet();
    return ok();
  }

  if (type === 'ready') {
    if (mg.phase !== 'place') return err('Ce n’est pas le moment.');
    mg.ready[actor.id] = true;
    if (mg.ids.every((id) => mg.ready[id])) {
      mg.phase = 'fire';
      mg.turn = pick(mg.ids);
    }
    return ok();
  }

  if (type === 'fire') {
    if (mg.phase !== 'fire') return err('Ce n’est pas le moment de tirer.');
    if (mg.turn !== actor.id) return err('Ce n’est pas ton tour.');
    const { r, c } = payload;
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= SIZE || c >= SIZE) return err('Case invalide.');
    const enemy = mg.boards[enemyId];
    if (enemy.shots[r][c]) return err('Tu as déjà tiré sur cette case.');
    const ship = enemy.ships.find((s) => s.some(([rr, cc]) => rr === r && cc === c));
    enemy.shots[r][c] = ship ? 'hit' : 'miss';
    mg.lastShot = { by: actor.id, r, c, result: ship ? (isSunk(enemy, ship) ? 'sunk' : 'hit') : 'miss' };
    if (enemy.ships.every((s) => isSunk(enemy, s))) {
      mg.winner = actor.id;
      mg.phase = 'end';
      room.phase = 'end';
    } else {
      mg.turn = enemyId;
    }
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const enemyId = mg.ids.find((id) => id !== playerId);
  const me = mg.boards[playerId];
  const enemy = mg.boards[enemyId];
  const over = mg.phase === 'end';
  return {
    phase: mg.phase,
    size: SIZE,
    mine: Boolean(me),
    ready: Boolean(mg.ready[playerId]),
    enemyReady: Boolean(mg.ready[enemyId]),
    myShips: me ? me.ships : [],
    incoming: me ? me.shots : emptyGrid(), // les tirs de l'adversaire sur ma grille
    outgoing: enemy ? enemy.shots : emptyGrid(), // mes tirs sur sa grille
    sunk: enemy ? enemy.ships.filter((s) => isSunk(enemy, s)) : [],
    enemyShips: over && enemy ? enemy.ships : [],
    turn: mg.turn,
    winner: mg.winner,
    lastShot: mg.lastShot,
    shipsLeft: enemy ? enemy.ships.filter((s) => !isSunk(enemy, s)).length : 0,
    myShipsLeft: me ? me.ships.filter((s) => !isSunk(me, s)).length : 0,
  };
}

module.exports = { meta, init, act, view, randomFleet, FLEET, SIZE };
