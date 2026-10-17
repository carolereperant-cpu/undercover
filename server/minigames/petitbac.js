'use strict';

/**
 * Petit bac : une lettre, 6 catégories, 90 secondes. Une réponse valide commence par la lettre.
 * Réponse unique = 2 points, réponse trouvée aussi par un autre joueur = 1 point.
 * Pendant la relecture, l'hôte peut refuser une réponse douteuse.
 */

const { ok, err, shuffle, cleanText, wordKey } = require('../common');
const { BAC_CATEGORIES, BAC_LETTERS } = require('./content2');

const ROUNDS = 5;
const CATS_PER_ROUND = 6;
const SECONDS = 90;
const GRACE_MS = 3000; // les réponses envoyées juste à la fin du temps sont acceptées

const meta = {
  id: 'petitbac',
  label: 'Petit bac',
  emoji: '📝',
  tagline: 'Une lettre, six catégories, 90 secondes !',
  min: 2,
  max: 13,
  minutes: '10 à 15',
  maxMinutes: 15,
  rules: [
    'Une lettre est tirée, avec 6 catégories (prénom, pays, animal…).',
    'Tu as 90 secondes pour écrire un mot commençant par cette lettre dans chaque catégorie.',
    'Réponse unique : 2 points. Même réponse qu’un autre joueur : 1 point. Mot vide ou mauvaise lettre : 0.',
    '5 manches. L’hôte peut refuser une réponse douteuse pendant la relecture.',
  ],
};

const keyOf = (text) => {
  const k = wordKey(text);
  return k.length > 3 ? k.replace(/[sx]$/, '') : k;
};

function newRound(mg, round) {
  mg.round = round;
  mg.letter = mg.letters[round - 1];
  mg.cats = shuffle(BAC_CATEGORIES).slice(0, CATS_PER_ROUND);
  mg.phase = 'write';
  mg.deadline = Date.now() + SECONDS * 1000;
  mg.answers = {};
  mg.submitted = {};
  mg.rejected = {};
}

function init(room) {
  room.mg = {
    total: ROUNDS,
    letters: shuffle(BAC_LETTERS).slice(0, ROUNDS),
    scores: Object.fromEntries(room.players.map((p) => [p.id, 0])),
  };
  newRound(room.mg, 1);
}

/** Pour chaque catégorie : la réponse de chaque joueur, sa validité et ses points. */
function evaluate(room) {
  const mg = room.mg;
  const first = wordKey(mg.letter);
  const roundPoints = Object.fromEntries(room.players.map((p) => [p.id, 0]));
  const rows = mg.cats.map((cat, i) => {
    const entries = room.players.map((p) => {
      const text = (mg.answers[p.id] ?? [])[i] ?? '';
      const rejected = Boolean(mg.rejected[`${p.id}:${i}`]);
      const valid = text !== '' && wordKey(text).startsWith(first) && !rejected;
      return { playerId: p.id, text, valid, rejected, points: 0 };
    });
    const count = {};
    for (const e of entries) if (e.valid) count[keyOf(e.text)] = (count[keyOf(e.text)] ?? 0) + 1;
    for (const e of entries) {
      if (!e.valid) continue;
      e.points = count[keyOf(e.text)] === 1 ? 2 : 1;
      roundPoints[e.playerId] += e.points;
    }
    return { category: cat, entries };
  });
  return { rows, roundPoints };
}

function toReview(room) {
  room.mg.phase = 'review';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');

  if (type === 'submit') {
    if (mg.phase !== 'write') return err('Ce n’est plus le moment d’écrire.');
    if (Date.now() > mg.deadline + GRACE_MS) return err('Trop tard, le temps est écoulé.');
    if (!Array.isArray(payload.answers)) return err('Réponses invalides.');
    mg.answers[actor.id] = mg.cats.map((_, i) => cleanText(payload.answers[i], 30));
    mg.submitted[actor.id] = true;
    if (room.players.every((p) => mg.submitted[p.id])) toReview(room);
    return ok();
  }

  // N'importe quel joueur peut clore la manche, mais seulement une fois le temps réellement écoulé.
  if (type === 'timeup') {
    if (mg.phase !== 'write') return err('Ce n’est pas le moment.');
    if (Date.now() < mg.deadline) return err('Le temps n’est pas écoulé.');
    toReview(room);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase !== 'write') return err('Ce n’est pas le moment.');
    toReview(room);
    return ok();
  }

  if (type === 'reject') {
    if (mg.phase !== 'review') return err('Ce n’est pas le moment.');
    const index = payload.index;
    if (!Number.isInteger(index) || index < 0 || index >= mg.cats.length) return err('Catégorie invalide.');
    if (!room.players.some((p) => p.id === payload.playerId)) return err('Joueur inconnu.');
    const key = `${payload.playerId}:${index}`;
    if (mg.rejected[key]) delete mg.rejected[key];
    else mg.rejected[key] = true;
    return ok();
  }

  if (type === 'next') {
    if (mg.phase !== 'review') return err('Ce n’est pas le moment.');
    const { roundPoints } = evaluate(room);
    for (const [id, pts] of Object.entries(roundPoints)) mg.scores[id] += pts;
    if (mg.round >= mg.total) {
      mg.phase = 'end';
      room.phase = 'end';
      return ok();
    }
    newRound(mg, mg.round + 1);
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const reviewing = mg.phase === 'review';
  const ev = reviewing ? evaluate(room) : null;
  return {
    phase: mg.phase,
    round: mg.round,
    total: mg.total,
    letter: mg.letter,
    cats: mg.cats,
    deadline: mg.phase === 'write' ? mg.deadline : null,
    serverNow: Date.now(),
    seconds: SECONDS,
    // Pendant l'écriture : seulement QUI a fini, jamais les réponses des autres.
    submitted: Object.keys(mg.submitted),
    myAnswers: mg.answers[playerId] ?? null,
    review: ev ? ev.rows : null,
    roundPoints: ev ? ev.roundPoints : null,
    ranking: Object.entries(mg.scores)
      .map(([id, points]) => ({ id, points }))
      .sort((a, b) => b.points - a.points),
  };
}

module.exports = { meta, init, act, view, evaluate };
