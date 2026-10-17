'use strict';

/**
 * Dessiner c'est gagné : un joueur découvre un mot secret sur son téléphone et le dessine sur une
 * vraie feuille. Les autres tapent leurs propositions. Le premier qui trouve gagne 2 points,
 * le dessinateur 1 point. Chacun dessine à son tour.
 */

const { ok, err, shuffle, cleanText, sameWord } = require('../common');
const { DRAW_WORDS } = require('./content');

const SECONDS = 90;
const GRACE_MS = 2000;

const meta = {
  id: 'dessin',
  label: 'Dessiner c’est gagné',
  emoji: '✏️',
  tagline: 'Un dessine sur papier, les autres devinent sur leur écran.',
  min: 3,
  max: 13,
  minutes: '15',
  maxMinutes: 20,
  rules: [
    'Il vous faut une feuille et un stylo (le dessin se fait sur du vrai papier).',
    'Le dessinateur découvre un mot secret sur son téléphone, puis le dessine : pas de lettres, pas de paroles.',
    'Les autres tapent leurs propositions sur leur écran. Ils ont 90 secondes.',
    'Le premier qui trouve gagne 2 points, le dessinateur 1 point. Chacun dessine à son tour.',
  ],
};

/** Nombre de manches : chacun dessine au moins une fois, 6 à 8 manches au maximum. */
const roundsFor = (n) => (n >= 6 ? 6 : Math.min(n * 2, 8));

function init(room) {
  const n = room.players.length;
  const total = roundsFor(n);
  const ids = shuffle(room.players.map((p) => p.id));
  room.mg = {
    round: 1,
    total,
    drawers: Array.from({ length: total }, (_, i) => ids[i % n]),
    deck: shuffle(DRAW_WORDS),
    wordIndex: 0,
    phase: 'ready',
    deadline: null,
    guesses: [],
    winnerId: null,
    rerolled: false,
    scores: Object.fromEntries(room.players.map((p) => [p.id, 0])),
  };
}

const drawerOf = (mg) => mg.drawers[mg.round - 1];
const wordOf = (mg) => mg.deck[mg.wordIndex];

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const drawerId = drawerOf(mg);

  if (type === 'reroll') {
    if (mg.phase !== 'ready') return err('Ce n’est plus le moment de changer de mot.');
    if (actor.id !== drawerId) return err('Seul le dessinateur peut changer de mot.');
    if (mg.rerolled) return err('Tu as déjà changé de mot une fois.');
    mg.wordIndex += 1;
    mg.rerolled = true;
    return ok();
  }

  if (type === 'start') {
    if (mg.phase !== 'ready') return err('Ce n’est pas le moment.');
    if (actor.id !== drawerId && actor.id !== room.hostId) return err('Seul le dessinateur ou l’hôte peut lancer le dessin.');
    mg.phase = 'draw';
    mg.deadline = Date.now() + SECONDS * 1000;
    return ok();
  }

  if (type === 'guess') {
    if (mg.phase !== 'draw') return err('Ce n’est pas le moment de deviner.');
    if (actor.id === drawerId) return err('Tu dessines : tu ne peux pas deviner !');
    if (Date.now() > mg.deadline + GRACE_MS) return err('Trop tard, le temps est écoulé.');
    const text = cleanText(payload.text, 40);
    if (!text) return err('Écris ta proposition.');
    mg.guesses.push({ playerId: actor.id, text });
    if (mg.guesses.length > 60) mg.guesses.shift();
    if (sameWord(text, wordOf(mg))) {
      mg.winnerId = actor.id;
      mg.scores[actor.id] += 2;
      mg.scores[drawerId] += 1;
      mg.phase = 'result';
    }
    return ok();
  }

  // N'importe qui peut clore la manche quand le temps est écoulé.
  if (type === 'timeup') {
    if (mg.phase !== 'draw') return err('Ce n’est pas le moment.');
    if (Date.now() < mg.deadline) return err('Le temps n’est pas écoulé.');
    mg.phase = 'result';
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase !== 'draw') return err('Ce n’est pas le moment.');
    mg.phase = 'result';
    return ok();
  }

  if (type === 'next') {
    if (mg.phase !== 'result') return err('Ce n’est pas le moment.');
    if (mg.round >= mg.total) {
      mg.phase = 'end';
      room.phase = 'end';
      return ok();
    }
    mg.round += 1;
    mg.wordIndex += 1;
    Object.assign(mg, { phase: 'ready', deadline: null, guesses: [], winnerId: null, rerolled: false });
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const drawerId = drawerOf(mg);
  const done = mg.phase === 'result' || mg.phase === 'end';
  return {
    phase: mg.phase,
    round: mg.round,
    total: mg.total,
    drawerId,
    // Le mot n'est connu que du dessinateur, jusqu'à la fin de la manche.
    word: playerId === drawerId || done ? wordOf(mg) : null,
    canReroll: playerId === drawerId && mg.phase === 'ready' && !mg.rerolled,
    deadline: mg.phase === 'draw' ? mg.deadline : null,
    serverNow: Date.now(),
    seconds: SECONDS,
    guesses: mg.guesses,
    winnerId: mg.winnerId,
    ranking: Object.entries(mg.scores)
      .map(([id, points]) => ({ id, points }))
      .sort((a, b) => b.points - a.points),
  };
}

module.exports = { meta, init, act, view, roundsFor };
