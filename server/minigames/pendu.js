'use strict';

/**
 * Pendu : un joueur (le « maître ») choisit un mot en secret, les autres proposent des lettres.
 * 7 erreurs maximum. Chacun est maître à tour de rôle (4 manches au plus).
 * Victoire des devineurs : +1 pour chacun, +1 de plus pour celui qui trouve la dernière lettre ou le mot.
 * Victoire du maître (le mot n'est pas trouvé) : +2.
 */

const { ok, err, shuffle, cleanText } = require('../common');

const MAX_ERRORS = 7;
const MAX_ROUNDS = 4;

const meta = {
  id: 'pendu',
  label: 'Pendu',
  emoji: '🪢',
  tagline: 'Trouve le mot secret avant que le dessin soit complet.',
  min: 2,
  max: 13,
  minutes: '5 à 10',
  maxMinutes: 10,
  rules: [
    'À chaque manche, un joueur choisit un mot secret (lettres uniquement, 3 à 20 lettres).',
    'Les autres proposent des lettres, ou tentent de deviner le mot entier.',
    'Chaque erreur dessine un morceau du pendu : à 7 erreurs, c’est perdu.',
    'Chacun choisit un mot à tour de rôle. Mot trouvé : points pour les devineurs. Mot non trouvé : 2 points pour le maître.',
  ],
};

/** Mot ou lettre sans accents, en majuscules ; renvoie null si ce ne sont pas que des lettres. */
function normalize(text, min, max) {
  const t = cleanText(text, 40)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toUpperCase();
  if (!/^[A-Z]+$/.test(t) || t.length < min || t.length > max) return null;
  return t;
}

function init(room) {
  const n = room.players.length;
  const total = Math.min(n, MAX_ROUNDS);
  const ids = shuffle(room.players.map((p) => p.id));
  room.mg = {
    round: 1,
    total,
    masters: Array.from({ length: total }, (_, i) => ids[i % n]),
    phase: 'choose',
    word: '',
    tried: [], // lettres essayées, dans l'ordre
    errors: 0,
    outcome: null,
    finisherId: null,
    scores: Object.fromEntries(room.players.map((p) => [p.id, 0])),
  };
}

const masterOf = (mg) => mg.masters[mg.round - 1];
const complete = (mg) => [...mg.word].every((c) => mg.tried.includes(c));

function win(room, finisherId) {
  const mg = room.mg;
  for (const p of room.players) if (p.id !== masterOf(mg)) mg.scores[p.id] += 1;
  mg.scores[finisherId] += 1;
  mg.outcome = 'won';
  mg.finisherId = finisherId;
  mg.phase = 'result';
}

function addError(room) {
  const mg = room.mg;
  mg.errors += 1;
  if (mg.errors >= MAX_ERRORS) {
    mg.scores[masterOf(mg)] += 2;
    mg.outcome = 'lost';
    mg.phase = 'result';
  }
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const masterId = masterOf(mg);

  if (type === 'word') {
    if (mg.phase !== 'choose') return err('Ce n’est pas le moment de choisir un mot.');
    if (actor.id !== masterId) return err('Ce n’est pas à toi de choisir le mot.');
    const word = normalize(payload.text, 3, 20);
    if (!word) return err('Le mot doit faire 3 à 20 lettres, sans espace ni chiffre.');
    mg.word = word;
    mg.phase = 'play';
    return ok();
  }

  if (type === 'letter') {
    if (mg.phase !== 'play') return err('Ce n’est pas le moment de jouer.');
    if (actor.id === masterId) return err('Tu as choisi le mot : tu ne peux pas jouer !');
    const letter = normalize(payload.letter, 1, 1);
    if (!letter) return err('Choisis une lettre.');
    if (mg.tried.includes(letter)) return err('Cette lettre a déjà été essayée.');
    mg.tried.push(letter);
    if (mg.word.includes(letter)) {
      if (complete(mg)) win(room, actor.id);
    } else {
      addError(room);
    }
    return ok();
  }

  if (type === 'solve') {
    if (mg.phase !== 'play') return err('Ce n’est pas le moment de jouer.');
    if (actor.id === masterId) return err('Tu as choisi le mot : tu ne peux pas jouer !');
    const guess = normalize(payload.text, 1, 40);
    if (!guess) return err('Écris un mot (lettres uniquement).');
    if (guess === mg.word) {
      for (const c of mg.word) if (!mg.tried.includes(c)) mg.tried.push(c);
      win(room, actor.id);
    } else {
      addError(room);
    }
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'next') {
    if (mg.phase !== 'result') return err('Ce n’est pas le moment.');
    if (mg.round >= mg.total) {
      mg.phase = 'end';
      room.phase = 'end';
      return ok();
    }
    mg.round += 1;
    Object.assign(mg, { phase: 'choose', word: '', tried: [], errors: 0, outcome: null, finisherId: null });
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const done = mg.phase === 'result' || mg.phase === 'end';
  const showWord = playerId === masterOf(mg) || done;
  return {
    phase: mg.phase,
    round: mg.round,
    total: mg.total,
    masterId: masterOf(mg),
    length: mg.word.length,
    // Les lettres pas encore trouvées restent cachées (null) pour les devineurs.
    pattern: [...mg.word].map((c) => (mg.tried.includes(c) || done ? c : null)),
    word: showWord && mg.word ? mg.word : null,
    tried: mg.tried,
    wrong: mg.tried.filter((c) => !mg.word.includes(c)),
    errors: mg.errors,
    maxErrors: MAX_ERRORS,
    outcome: mg.outcome,
    finisherId: mg.finisherId,
    ranking: Object.entries(mg.scores)
      .map(([id, points]) => ({ id, points }))
      .sort((a, b) => b.points - a.points),
  };
}

module.exports = { meta, init, act, view, normalize };
