'use strict';

/**
 * Just One (coopératif) : à chaque manche, un joueur doit deviner un mot qu'il ne voit pas.
 * Les autres écrivent chacun un indice d'un seul mot. Les indices identiques s'annulent :
 * le devineur ne voit que les indices uniques. Bonne réponse = 1 point pour toute l'équipe.
 */

const { ok, err, shuffle, cleanText, wordKey, sameWord } = require('../common');
const { JUST_ONE_WORDS } = require('./content');

const ROUNDS = 7;

const meta = {
  id: 'justone',
  label: 'Just One',
  emoji: '☝️',
  tagline: 'Des indices uniques pour faire deviner un mot, tous ensemble.',
  min: 3,
  max: 13,
  minutes: '15',
  maxMinutes: 20,
  rules: [
    'À chaque manche, un joueur doit deviner un mot. Il ne le voit pas, tous les autres le voient.',
    'Chacun écrit un indice d’un seul mot (pas de mot de la même famille que la réponse).',
    'Les indices identiques s’annulent : le devineur ne verra pas ceux qui sont en double !',
    'Le devineur propose un mot ou passe. Bonne réponse = 1 point pour l’équipe, sur 7 manches.',
  ],
};

const guesserOf = (mg) => mg.order[(mg.round - 1) % mg.order.length];
const wordOf = (mg) => mg.deck[mg.round - 1];

/** Clé de comparaison des indices : sans accent, majuscule, article, ni pluriel. */
function clueKey(text) {
  const k = wordKey(text);
  return k.length > 3 ? k.replace(/[sx]$/, '') : k;
}

function init(room) {
  room.mg = {
    round: 1,
    total: ROUNDS,
    order: shuffle(room.players.map((p) => p.id)),
    deck: shuffle(JUST_ONE_WORDS).slice(0, ROUNDS),
    phase: 'write',
    clues: {},
    kept: [],
    cancelled: [],
    guess: null,
    passed: false,
    correct: false,
    score: 0,
    history: [],
  };
}

function toGuess(room) {
  const mg = room.mg;
  const entries = Object.entries(mg.clues).map(([authorId, text]) => ({ authorId, text, key: clueKey(text) }));
  const count = {};
  for (const e of entries) count[e.key] = (count[e.key] ?? 0) + 1;
  mg.kept = shuffle(entries.filter((e) => count[e.key] === 1)).map(({ authorId, text }) => ({ authorId, text }));
  mg.cancelled = entries.filter((e) => count[e.key] > 1).map(({ authorId, text }) => ({ authorId, text }));
  mg.phase = 'guess';
}

function finishRound(room, guess, passed) {
  const mg = room.mg;
  mg.guess = guess;
  mg.passed = passed;
  mg.correct = !passed && sameWord(guess, wordOf(mg));
  if (mg.correct) mg.score += 1;
  mg.history.push({ round: mg.round, word: wordOf(mg), guesserId: guesserOf(mg), guess, passed, correct: mg.correct });
  mg.phase = 'result';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const guesserId = guesserOf(mg);

  if (type === 'clue') {
    if (mg.phase !== 'write') return err('Ce n’est pas le moment d’écrire un indice.');
    if (actor.id === guesserId) return err('C’est toi qui devines : tu ne donnes pas d’indice !');
    const text = cleanText(payload.text, 25);
    if (!text) return err('Écris un indice.');
    if (text.includes(' ')) return err('Un seul mot, pas une phrase !');
    const kc = wordKey(text);
    const kw = wordKey(wordOf(mg));
    if (kc.length >= 3 && (kw.includes(kc) || kc.includes(kw))) return err('Cet indice ressemble trop au mot à faire deviner.');
    mg.clues[actor.id] = text;
    if (room.players.filter((p) => p.id !== guesserId).every((p) => mg.clues[p.id])) toGuess(room);
    return ok();
  }

  if (type === 'guess') {
    if (mg.phase !== 'guess') return err('Ce n’est pas le moment de deviner.');
    if (actor.id !== guesserId) return err('Seul le devineur peut répondre.');
    const text = cleanText(payload.text, 40);
    if (!text) return err('Écris ta proposition.');
    finishRound(room, text, false);
    return ok();
  }

  if (type === 'pass') {
    if (mg.phase !== 'guess') return err('Ce n’est pas le moment.');
    if (actor.id !== guesserId && actor.id !== room.hostId) return err('Seul le devineur ou l’hôte peut passer.');
    finishRound(room, '', true);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase !== 'write') return err('Ce n’est pas le moment.');
    if (Object.keys(mg.clues).length === 0) return err('Personne n’a encore écrit d’indice.');
    toGuess(room);
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
    Object.assign(mg, { phase: 'write', clues: {}, kept: [], cancelled: [], guess: null, passed: false, correct: false });
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const guesserId = guesserOf(mg);
  const isGuesser = playerId === guesserId;
  const done = mg.phase === 'result' || mg.phase === 'end';
  // Le devineur ne voit jamais le mot, ni les auteurs ni les indices annulés, avant la fin de la manche.
  const reveal = !isGuesser || done;
  return {
    phase: mg.phase,
    round: mg.round,
    total: mg.total,
    guesserId,
    score: mg.score,
    word: reveal ? wordOf(mg) : null,
    submitted: Object.keys(mg.clues),
    myClue: mg.clues[playerId] ?? null,
    kept: mg.phase === 'guess' || done ? mg.kept.map((c) => ({ text: c.text, authorId: reveal ? c.authorId : null })) : [],
    cancelled: (mg.phase === 'guess' || done) && reveal ? mg.cancelled : [],
    cancelledCount: mg.phase === 'guess' || done ? mg.cancelled.length : 0,
    guess: done ? mg.guess : null,
    passed: done ? mg.passed : false,
    correct: done ? mg.correct : false,
    history: mg.history,
  };
}

module.exports = { meta, init, act, view, clueKey };
