'use strict';

/**
 * Téléphone dessin : un téléphone arabe, entre dessin et description.
 * Chaque joueur démarre une « chaîne » avec un mot secret qu'il dessine sur sa feuille.
 * Le voisin décrit le dessin avec des mots (sur son téléphone), le suivant dessine cette description, etc.
 * Les dessins sont sur du vrai papier : le serveur ne s'occupe que des textes et de qui fait quoi.
 *
 * Aux étapes paires (0, 2, 4) on dessine, aux étapes impaires (1, 3, 5) on décrit.
 * À l'étape s, le joueur n°i (dans `order`) travaille sur la chaîne (i - s) modulo n :
 * il n'y a donc jamais deux fois le même joueur sur une chaîne tant que steps <= n.
 */

const { ok, err, shuffle, cleanText } = require('../common');
const { DRAW_WORDS } = require('./content');

const meta = {
  id: 'telephone',
  label: 'Téléphone dessin',
  emoji: '📞',
  tagline: 'Un mot dessiné, décrit, redessiné… jusqu’au grand n’importe quoi.',
  min: 4,
  max: 13,
  minutes: '15 à 20',
  maxMinutes: 20,
  rules: [
    'Il vous faut une feuille et un stylo par joueur (les dessins sont sur du vrai papier).',
    'Chacun reçoit un mot secret sur son téléphone et le dessine sur sa feuille, sans lettres ni paroles.',
    'Tu passes ta feuille à ton voisin, qui écrit sur son téléphone ce qu’il voit dans le dessin.',
    'Le suivant dessine cette description sur une nouvelle feuille, et ainsi de suite.',
    'À la fin, on révèle chaque histoire : du mot de départ jusqu’au résultat final !',
  ],
};

/** Nombre d'étapes : toujours pair (on termine par une description) et jamais plus que de joueurs. */
const stepsFor = (n) => (n >= 6 ? 6 : 4);

const chainOf = (mg, index, step) => (((index - step) % mg.n) + mg.n) % mg.n;

function init(room) {
  const order = shuffle(room.players.map((p) => p.id));
  const n = order.length;
  const words = shuffle(DRAW_WORDS).slice(0, n);
  room.mg = {
    order,
    n,
    steps: stepsFor(n),
    step: 0,
    phase: 'play',
    done: {},
    chains: words.map((start) => ({ start, desc: {} })), // desc[s] = description écrite à l'étape s (impaire)
    revealed: 0,
  };
}

function advance(room) {
  const mg = room.mg;
  mg.step += 1;
  mg.done = {};
  if (mg.step >= mg.steps) mg.phase = 'reveal';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const index = mg.order.indexOf(actor.id);

  if (type === 'drawn') {
    if (mg.phase !== 'play' || mg.step % 2 !== 0) return err('Ce n’est pas le moment de dessiner.');
    mg.done[actor.id] = true;
    if (room.players.every((p) => mg.done[p.id])) advance(room);
    return ok();
  }

  if (type === 'describe') {
    if (mg.phase !== 'play' || mg.step % 2 !== 1) return err('Ce n’est pas le moment de décrire.');
    const text = cleanText(payload.text, 60);
    if (!text) return err('Écris ce que tu vois dans le dessin.');
    mg.chains[chainOf(mg, index, mg.step)].desc[mg.step] = text;
    mg.done[actor.id] = true;
    if (room.players.every((p) => mg.done[p.id])) advance(room);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase !== 'play') return err('Ce n’est pas le moment.');
    if (mg.step % 2 === 1) {
      // Les descriptions manquantes sont remplacées par des points de suspension.
      mg.order.forEach((id, i) => {
        const chain = mg.chains[chainOf(mg, i, mg.step)];
        if (!(mg.step in chain.desc)) chain.desc[mg.step] = '…';
      });
    }
    advance(room);
    return ok();
  }

  if (type === 'next') {
    if (mg.phase !== 'reveal') return err('Ce n’est pas le moment.');
    if (mg.revealed < mg.n) {
      mg.revealed += 1;
      return ok();
    }
    mg.phase = 'end';
    room.phase = 'end';
    return ok();
  }

  return err('Action inconnue.');
}

/** Le récit complet d'une chaîne, étape par étape (utilisé uniquement à la révélation). */
function story(mg, c) {
  const chain = mg.chains[c];
  const steps = [];
  for (let s = 0; s < mg.steps; s++) {
    const playerId = mg.order[(c + s) % mg.n];
    if (s % 2 === 0) steps.push({ kind: 'draw', playerId, text: s === 0 ? chain.start : chain.desc[s - 1] });
    else steps.push({ kind: 'describe', playerId, text: chain.desc[s] });
  }
  return steps;
}

function view(room, playerId) {
  const mg = room.mg;
  const index = mg.order.indexOf(playerId);
  const base = {
    phase: mg.phase,
    step: mg.step,
    steps: mg.steps,
    order: mg.order,
    done: Object.keys(mg.done),
    revealed: mg.revealed,
    stories: [],
    task: null,
  };
  if (mg.phase === 'reveal' || mg.phase === 'end') {
    base.stories = Array.from({ length: mg.revealed }, (_, c) => story(mg, c));
    return base;
  }
  const s = mg.step;
  const chain = mg.chains[chainOf(mg, index, s)];
  const n = mg.n;
  if (s % 2 === 0) {
    // À dessiner : seul ce joueur voit le texte à dessiner.
    base.task = {
      kind: 'draw',
      text: s === 0 ? chain.start : chain.desc[s - 1],
      toId: mg.order[(index + 1) % n], // à qui passer la feuille ensuite
      done: Boolean(mg.done[playerId]),
    };
  } else {
    base.task = {
      kind: 'describe',
      fromId: mg.order[(index - 1 + n) % n], // qui va te passer sa feuille
      myText: chain.desc[s] ?? null,
      done: Boolean(mg.done[playerId]),
    };
  }
  return base;
}

module.exports = { meta, init, act, view, stepsFor, chainOf };
