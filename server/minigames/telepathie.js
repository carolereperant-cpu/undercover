'use strict';

/**
 * Télépathie : tout le monde écrit un mot en secret, puis les mots sont révélés.
 * On recommence en essayant de se rapprocher, jusqu'à écrire tous le même mot (8 manches maximum).
 */

const { ok, err, cleanText, sameWord } = require('../common');

const MAX_ROUNDS = 8;

const meta = {
  id: 'telepathie',
  label: 'Télépathie',
  emoji: '🧠',
  tagline: 'Écrivez un mot en même temps… et trouvez le même !',
  min: 2,
  max: 8,
  minutes: '5 à 10',
  maxMinutes: 10,
  rules: [
    'Chacun écrit un mot en secret, sans parler.',
    'Les mots sont révélés ensemble.',
    'Si ce ne sont pas les mêmes, on recommence en essayant de se rapprocher des mots des autres.',
    'Objectif : écrire tous le même mot en 8 manches maximum.',
  ],
};

function init(room) {
  room.mg = { round: 1, maxRounds: MAX_ROUNDS, phase: 'write', words: {}, history: [], won: false };
}

function reveal(room) {
  const mg = room.mg;
  const words = { ...mg.words };
  mg.history.push({ round: mg.round, words });
  const list = room.players.map((p) => words[p.id] ?? '');
  const allSame = list.every((w) => w && sameWord(w, list[0]));
  if (allSame) {
    mg.won = true;
    mg.phase = 'end';
    room.phase = 'end';
  } else if (mg.round >= mg.maxRounds) {
    mg.phase = 'end';
    room.phase = 'end';
  } else {
    mg.phase = 'reveal';
  }
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');

  if (type === 'word') {
    if (mg.phase !== 'write') return err('Ce n’est pas le moment d’écrire.');
    const word = cleanText(payload.word, 30);
    if (!word) return err('Écris un mot.');
    mg.words[actor.id] = word;
    if (room.players.every((p) => mg.words[p.id])) reveal(room);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase !== 'write') return err('Ce n’est pas le moment.');
    if (Object.keys(mg.words).length === 0) return err('Personne n’a encore écrit.');
    reveal(room);
    return ok();
  }

  if (type === 'next') {
    if (mg.phase !== 'reveal') return err('Ce n’est pas le moment.');
    mg.round += 1;
    mg.words = {};
    mg.phase = 'write';
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  return {
    phase: mg.phase,
    round: mg.round,
    maxRounds: mg.maxRounds,
    submitted: Object.keys(mg.words),
    myWord: mg.words[playerId] ?? null,
    history: mg.history, // uniquement les manches terminées : les mots en cours restent secrets
    won: mg.won,
  };
}

module.exports = { meta, init, act, view };
