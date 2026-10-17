'use strict';

/**
 * Qui suis-je ? : chaque joueur reçoit un personnage que TOUS les autres voient, sauf lui.
 * À voix haute, on pose des questions auxquelles on répond par oui ou non, chacun son tour.
 * Quand on pense avoir trouvé, on tape son personnage : le serveur vérifie.
 * Les premiers à trouver gagnent le plus de points.
 */

const { ok, err, shuffle, cleanText, sameWord } = require('../common');
const { CHARACTERS } = require('./content2');

const meta = {
  id: 'quisuisje',
  label: 'Qui suis-je ?',
  emoji: '🕵️',
  tagline: 'Tout le monde voit ton personnage… sauf toi !',
  min: 3,
  max: 13,
  minutes: '15',
  maxMinutes: 20,
  rules: [
    'Chaque joueur reçoit un personnage que les autres voient, mais pas lui (seule sa catégorie est indiquée).',
    'À voix haute, chacun son tour pose une question à laquelle on ne répond que par oui ou non.',
    'Quand tu penses avoir trouvé, tape ton personnage : bonne réponse = tu es sauvé !',
    'Les premiers à trouver marquent le plus de points. L’hôte peut terminer la partie à tout moment.',
  ],
};

function init(room) {
  const picks = shuffle(CHARACTERS).slice(0, room.players.length);
  room.mg = {
    phase: 'play',
    cards: Object.fromEntries(room.players.map((p, i) => [p.id, picks[i]])), // id → [nom, alias, catégorie]
    solved: {}, // id → rang (1 = premier)
    wrong: Object.fromEntries(room.players.map((p) => [p.id, 0])),
    count: 0,
  };
}

function finish(room) {
  room.mg.phase = 'end';
  room.phase = 'end';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');

  if (type === 'guess') {
    if (mg.phase !== 'play') return err('La partie est terminée.');
    if (actor.id in mg.solved) return err('Tu as déjà trouvé !');
    const text = cleanText(payload.text, 40);
    if (!text) return err('Écris ta réponse.');
    const [name, aliases] = mg.cards[actor.id];
    if ([name, ...aliases].some((n) => sameWord(text, n))) {
      mg.count += 1;
      mg.solved[actor.id] = mg.count;
      if (room.players.every((p) => p.id in mg.solved)) finish(room);
    } else {
      mg.wrong[actor.id] += 1;
    }
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'end') {
    if (mg.phase !== 'play') return err('Ce n’est pas le moment.');
    finish(room);
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const n = room.players.length;
  const ended = mg.phase === 'end';
  const cards = room.players.map((p) => {
    const hidden = p.id === playerId && !(p.id in mg.solved) && !ended;
    return {
      id: p.id,
      category: mg.cards[p.id][2],
      // Jamais le personnage de celui qui regarde, tant qu'il n'a pas trouvé.
      name: hidden ? null : mg.cards[p.id][0],
      rank: mg.solved[p.id] ?? null,
      wrong: mg.wrong[p.id],
    };
  });
  const ranking = room.players
    .map((p) => ({ id: p.id, points: p.id in mg.solved ? Math.max(1, n - mg.solved[p.id] + 1) : 0 }))
    .sort((a, b) => b.points - a.points);
  return { phase: mg.phase, cards, ranking, solvedCount: Object.keys(mg.solved).length };
}

module.exports = { meta, init, act, view };
