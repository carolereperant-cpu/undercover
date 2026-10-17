'use strict';

/**
 * Le Dictionnaire : un mot rare s'affiche. Chacun invente une fausse définition, puis tout le monde
 * vote pour celle qu'il croit vraie. +2 points pour la bonne réponse, +1 par joueur piégé par sa fausse définition.
 */

const { ok, err, shuffle, cleanText, wordKey } = require('../common');
const { DEFINITIONS } = require('./content');

const ROUNDS = 5;

const meta = {
  id: 'dictionnaire',
  label: 'Le Dictionnaire',
  emoji: '📖',
  tagline: 'Invente une fausse définition et piège les autres.',
  min: 3,
  max: 13,
  minutes: '15',
  maxMinutes: 20,
  rules: [
    'Un mot rare s’affiche. Chacun écrit une fausse définition crédible.',
    'Toutes les définitions (la vraie est mélangée avec) sont affichées.',
    'Chacun vote pour celle qu’il croit vraie : +2 points si c’est la bonne.',
    'Tu gagnes 1 point à chaque joueur piégé par ta fausse définition. 5 manches.',
  ],
};

function init(room) {
  room.mg = {
    round: 1,
    total: ROUNDS,
    deck: shuffle(DEFINITIONS).slice(0, ROUNDS),
    phase: 'write',
    defs: {},
    options: [],
    votes: {},
    result: null,
    scores: Object.fromEntries(room.players.map((p) => [p.id, 0])),
  };
}

function toVote(room) {
  const mg = room.mg;
  const [, real] = mg.deck[mg.round - 1];
  const entries = [{ text: real, authorId: null }, ...Object.entries(mg.defs).map(([authorId, text]) => ({ text, authorId }))];
  mg.options = shuffle(entries).map((e, i) => ({ id: `o${i}`, text: e.text, authorId: e.authorId }));
  mg.phase = 'vote';
}

function resolve(room) {
  const mg = room.mg;
  const real = mg.options.find((o) => o.authorId === null);
  const options = mg.options.map((o) => ({
    id: o.id,
    text: o.text,
    authorId: o.authorId,
    voters: Object.keys(mg.votes).filter((voter) => mg.votes[voter] === o.id),
  }));
  for (const o of options) {
    if (o.authorId === null) for (const voter of o.voters) mg.scores[voter] += 2;
    else mg.scores[o.authorId] += o.voters.length;
  }
  mg.result = { options, realId: real.id };
  mg.phase = 'result';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');

  if (type === 'define') {
    if (mg.phase !== 'write') return err('Ce n’est pas le moment d’écrire.');
    const text = cleanText(payload.text, 140);
    if (text.length < 3) return err('Écris une définition un peu plus longue.');
    const [, real] = mg.deck[mg.round - 1];
    if (wordKey(text) === wordKey(real)) return err('C’est exactement la vraie définition : invente-en une autre !');
    mg.defs[actor.id] = text;
    if (room.players.every((p) => mg.defs[p.id])) toVote(room);
    return ok();
  }

  if (type === 'vote') {
    if (mg.phase !== 'vote') return err('Ce n’est pas le moment de voter.');
    const option = mg.options.find((o) => o.id === payload.optionId);
    if (!option) return err('Choix invalide.');
    if (option.authorId === actor.id) return err('Tu ne peux pas voter pour ta propre définition.');
    mg.votes[actor.id] = option.id;
    if (room.players.every((p) => mg.votes[p.id])) resolve(room);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase === 'write') {
      if (Object.keys(mg.defs).length === 0) return err('Personne n’a encore écrit.');
      toVote(room);
      return ok();
    }
    if (mg.phase === 'vote') {
      if (Object.keys(mg.votes).length === 0) return err('Personne n’a encore voté.');
      resolve(room);
      return ok();
    }
    return err('Ce n’est pas le moment.');
  }

  if (type === 'next') {
    if (mg.phase !== 'result') return err('Ce n’est pas le moment.');
    if (mg.round >= mg.total) {
      mg.phase = 'end';
      room.phase = 'end';
      return ok();
    }
    mg.round += 1;
    mg.defs = {};
    mg.options = [];
    mg.votes = {};
    mg.result = null;
    mg.phase = 'write';
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const [word] = mg.deck[mg.round - 1];
  const ranking = Object.entries(mg.scores)
    .map(([id, points]) => ({ id, points }))
    .sort((a, b) => b.points - a.points);
  return {
    phase: mg.phase,
    round: mg.round,
    total: mg.total,
    word,
    submitted: Object.keys(mg.defs),
    myDef: mg.defs[playerId] ?? null,
    // On n'envoie pas l'auteur des définitions avant le résultat ; le joueur voit seulement quelle est la sienne.
    options: mg.phase === 'vote' ? mg.options.map((o) => ({ id: o.id, text: o.text, mine: o.authorId === playerId })) : [],
    voted: Object.keys(mg.votes),
    myVote: mg.votes[playerId] ?? null,
    result: mg.phase === 'result' || mg.phase === 'end' ? mg.result : null,
    ranking,
  };
}

module.exports = { meta, init, act, view };
