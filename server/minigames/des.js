'use strict';

/**
 * Dés menteurs : chacun cache 5 dés. À tour de rôle on annonce un pari (« il y a au moins 4 dés de valeur 3 »
 * sur toute la table) de plus en plus haut, ou on crie « menteur ! ». Celui qui a tort perd un dé.
 */

const crypto = require('node:crypto');
const { ok, err } = require('../common');

const START_DICE = 5;

const meta = {
  id: 'des',
  label: 'Dés menteurs',
  emoji: '🎲',
  tagline: 'Bluffe sur tes dés cachés, démasque les menteurs.',
  min: 2,
  max: 6,
  minutes: '10 à 15',
  maxMinutes: 15,
  rules: [
    'Chacun a 5 dés secrets. À ton tour, annonce un pari sur tous les dés de la table : « au moins 4 dés de valeur 3 ».',
    'Chaque pari doit être plus haut : plus de dés, ou autant de dés avec une valeur plus grande.',
    'À la place, tu peux crier « Menteur ! » : on retourne tous les dés. Celui qui avait tort perd un dé.',
    'Le dernier joueur avec des dés gagne.',
  ],
};

const roll = (n) => Array.from({ length: n }, () => crypto.randomInt(1, 7));

function rollAll(mg) {
  mg.dice = {};
  for (const id of mg.order) mg.dice[id] = mg.counts[id] > 0 ? roll(mg.counts[id]) : [];
}

function init(room) {
  const order = room.players.map((p) => p.id);
  const mg = {
    order,
    counts: Object.fromEntries(order.map((id) => [id, START_DICE])),
    dice: {},
    round: 1,
    turnId: order[crypto.randomInt(order.length)],
    bid: null, // { qty, face, by }
    phase: 'bid',
    result: null,
    winner: null,
  };
  rollAll(mg);
  room.mg = mg;
}

const alive = (mg) => mg.order.filter((id) => mg.counts[id] > 0);
const totalDice = (mg) => alive(mg).reduce((sum, id) => sum + mg.counts[id], 0);

function nextAlive(mg, fromId) {
  const list = alive(mg);
  const start = mg.order.indexOf(fromId);
  for (let i = 1; i <= mg.order.length; i++) {
    const id = mg.order[(start + i) % mg.order.length];
    if (list.includes(id)) return id;
  }
  return fromId;
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');

  if (type === 'bid') {
    if (mg.phase !== 'bid') return err('Ce n’est pas le moment.');
    if (mg.turnId !== actor.id) return err('Ce n’est pas ton tour.');
    const { qty, face } = payload;
    if (!Number.isInteger(qty) || !Number.isInteger(face) || face < 1 || face > 6) return err('Pari invalide.');
    if (qty < 1 || qty > totalDice(mg)) return err('Ce nombre de dés n’existe pas sur la table.');
    if (mg.bid && !(qty > mg.bid.qty || (qty === mg.bid.qty && face > mg.bid.face))) {
      return err('Ton pari doit être plus haut : plus de dés, ou autant avec une valeur plus grande.');
    }
    mg.bid = { qty, face, by: actor.id };
    mg.turnId = nextAlive(mg, actor.id);
    return ok();
  }

  if (type === 'liar') {
    if (mg.phase !== 'bid') return err('Ce n’est pas le moment.');
    if (mg.turnId !== actor.id) return err('Ce n’est pas ton tour.');
    if (!mg.bid) return err('Personne n’a encore parié.');
    const inPlay = alive(mg);
    const found = inPlay.reduce((sum, id) => sum + mg.dice[id].filter((d) => d === mg.bid.face).length, 0);
    const bidderRight = found >= mg.bid.qty;
    const loserId = bidderRight ? actor.id : mg.bid.by;
    mg.counts[loserId] -= 1;
    mg.result = {
      challengerId: actor.id,
      bid: mg.bid,
      found,
      loserId,
      dice: Object.fromEntries(inPlay.map((id) => [id, mg.dice[id]])), // tous les dés sont retournés
      eliminated: mg.counts[loserId] === 0,
    };
    mg.phase = 'reveal';
    return ok();
  }

  if (type === 'next') {
    if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');
    if (mg.phase !== 'reveal') return err('Ce n’est pas le moment.');
    const left = alive(mg);
    if (left.length <= 1) {
      mg.winner = left[0] ?? null;
      mg.phase = 'end';
      room.phase = 'end';
      return ok();
    }
    const { loserId } = mg.result;
    mg.round += 1;
    mg.bid = null;
    mg.result = null;
    // Le perdant ouvre la manche suivante ; s'il est éliminé, c'est le joueur suivant.
    mg.turnId = mg.counts[loserId] > 0 ? loserId : nextAlive(mg, loserId);
    rollAll(mg);
    mg.phase = 'bid';
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  return {
    phase: mg.phase,
    round: mg.round,
    order: mg.order,
    counts: mg.counts,
    turnId: mg.turnId,
    bid: mg.bid,
    myDice: mg.dice[playerId] ?? [], // chacun ne voit que ses propres dés
    total: totalDice(mg),
    result: mg.phase === 'reveal' || mg.phase === 'end' ? mg.result : null,
    winner: mg.winner,
  };
}

module.exports = { meta, init, act, view };
