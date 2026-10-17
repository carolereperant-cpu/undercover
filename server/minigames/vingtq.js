'use strict';

/**
 * 20 questions : un joueur pense à un mot (choisi par le serveur), les autres posent des questions
 * auxquelles il répond par oui, non ou peut-être. Un essai raté compte comme une question.
 */

const { ok, err, cleanText, pick, sameWord } = require('../common');
const { THEMES } = require('../words');

const MAX_QUESTIONS = 20;
const ANSWERS = ['oui', 'non', 'peutetre'];
const ALL_WORDS = [...new Set(THEMES.flatMap((t) => t.pairs.flat()))].filter((w) => w.length <= 22);

const meta = {
  id: 'vingtq',
  label: '20 questions',
  emoji: '❓',
  tagline: 'Devinez le mot secret en posant des questions.',
  min: 2,
  max: 6,
  minutes: '5 à 10',
  maxMinutes: 10,
  rules: [
    'Un joueur tiré au sort voit un mot secret et répond aux questions.',
    'Les autres posent des questions auxquelles on répond par oui, non ou peut-être.',
    'On peut proposer un mot à tout moment, mais un essai raté compte comme une question.',
    'Les devineurs ont 20 questions pour trouver le mot.',
  ],
};

function init(room) {
  const thinker = pick(room.players);
  room.mg = {
    thinkerId: thinker.id,
    word: pick(ALL_WORDS),
    log: [],
    pending: false,
    used: 0,
    max: MAX_QUESTIONS,
    phase: 'play',
    winner: null,
  };
}

function finish(room, winner) {
  room.mg.phase = 'end';
  room.mg.winner = winner;
  room.phase = 'end';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const isThinker = actor.id === mg.thinkerId;

  if (type === 'ask') {
    if (isThinker) return err('Tu connais déjà le mot.');
    if (mg.pending) return err('Attends la réponse à la question précédente.');
    const text = cleanText(payload.text, 100);
    if (!text) return err('Écris ta question.');
    mg.log.push({ by: actor.id, q: text, a: null, guess: false });
    mg.pending = true;
    return ok();
  }

  if (type === 'answer') {
    if (!isThinker) return err('Seul le joueur qui pense au mot répond.');
    if (!mg.pending) return err('Aucune question en attente.');
    if (!ANSWERS.includes(payload.answer)) return err('Réponse invalide.');
    mg.log[mg.log.length - 1].a = payload.answer;
    mg.pending = false;
    mg.used += 1;
    if (mg.used >= mg.max) finish(room, 'thinker');
    return ok();
  }

  if (type === 'guess') {
    if (isThinker) return err('Tu connais déjà le mot.');
    if (mg.pending) return err('Attends la réponse à la question précédente.');
    const text = cleanText(payload.text, 40);
    if (!text) return err('Écris un mot.');
    const right = sameWord(text, mg.word);
    mg.used += 1;
    mg.log.push({ by: actor.id, q: `Est-ce « ${text} » ?`, a: right ? 'oui' : 'non', guess: true });
    if (right) finish(room, 'guessers');
    else if (mg.used >= mg.max) finish(room, 'thinker');
    return ok();
  }

  if (type === 'change') {
    if (!isThinker) return err('Seul le joueur qui pense au mot peut le changer.');
    if (mg.used > 0 || mg.pending) return err('Trop tard pour changer de mot.');
    mg.word = pick(ALL_WORDS);
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const isThinker = playerId === mg.thinkerId;
  return {
    phase: mg.phase,
    thinkerId: mg.thinkerId,
    isThinker,
    word: isThinker || mg.phase === 'end' ? mg.word : null,
    log: mg.log,
    pending: mg.pending,
    used: mg.used,
    max: mg.max,
    winner: mg.winner,
  };
}

module.exports = { meta, init, act, view };
