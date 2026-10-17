'use strict';

/**
 * Quiz buzzer : questions à 4 réponses tirées dans les thèmes choisis par l'hôte.
 * Tout le monde répond en même temps ; le serveur note l'ordre d'arrivée.
 * Bonne réponse : 3 points pour le plus rapide, 2 pour le deuxième, 1 pour les suivants.
 */

const { ok, err, shuffle } = require('../common');
const { QUIZ } = require('./quizdata');
const { THEMES } = require('../words');

const QUESTIONS_PER_GAME = 10;
const SECONDS = 20;
const GRACE_MS = 1500; // marge pour la latence réseau
const POINTS = [3, 2, 1];

const meta = {
  id: 'quiz',
  label: 'Quiz buzzer',
  emoji: '🔔',
  tagline: 'Réponds vite et juste : le plus rapide marque le plus de points.',
  min: 2,
  max: 13,
  minutes: '10 à 15',
  maxMinutes: 15,
  themes: true,
  rules: [
    '10 questions tirées dans les thèmes choisis par l’hôte, 4 réponses possibles.',
    'Tout le monde répond en même temps, en 20 secondes. On ne peut pas changer sa réponse.',
    'Bonne réponse : 3 points pour le plus rapide, 2 pour le deuxième, 1 pour les suivants.',
    'Mauvaise réponse ou pas de réponse : 0 point.',
  ],
};

/** Nombre de questions disponibles pour un thème (affiché dans la salle d'attente). */
const themeCount = (themeId) => (QUIZ[themeId] ?? []).length;

function buildQuestions(themeIds) {
  const pool = themeIds.flatMap((id) => (QUIZ[id] ?? []).map(([q, good, bad]) => ({ theme: id, q, good, bad })));
  return shuffle(pool)
    .slice(0, QUESTIONS_PER_GAME)
    .map(({ theme, q, good, bad }) => {
      const choices = shuffle([good, ...bad]);
      return { theme, q, choices, answer: choices.indexOf(good) };
    });
}

function startQuestion(mg) {
  mg.phase = 'question';
  mg.deadline = Date.now() + SECONDS * 1000;
  mg.answers = {};
  mg.order = [];
  mg.result = null;
}

function init(room) {
  const questions = buildQuestions(room.options.themes);
  room.mg = {
    round: 1,
    total: questions.length,
    questions,
    scores: Object.fromEntries(room.players.map((p) => [p.id, 0])),
  };
  startQuestion(room.mg);
}

function resolve(room) {
  const mg = room.mg;
  const question = mg.questions[mg.round - 1];
  let rank = 0;
  const answers = mg.order.map((playerId) => {
    const choice = mg.answers[playerId];
    const correct = choice === question.answer;
    const points = correct ? (POINTS[rank++] ?? 1) : 0;
    mg.scores[playerId] += points;
    return { playerId, choice, correct, points };
  });
  mg.result = { answer: question.answer, answers };
  mg.phase = 'result';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');

  if (type === 'answer') {
    if (mg.phase !== 'question') return err('Ce n’est pas le moment de répondre.');
    if (Date.now() > mg.deadline + GRACE_MS) return err('Trop tard, le temps est écoulé.');
    if (actor.id in mg.answers) return err('Tu as déjà répondu.');
    const choice = payload.choice;
    const count = mg.questions[mg.round - 1].choices.length;
    if (!Number.isInteger(choice) || choice < 0 || choice >= count) return err('Réponse invalide.');
    mg.answers[actor.id] = choice;
    mg.order.push(actor.id);
    if (room.players.every((p) => p.id in mg.answers)) resolve(room);
    return ok();
  }

  // N'importe quel joueur peut déclencher la fin du temps, mais seulement une fois le temps réellement écoulé.
  if (type === 'timeup') {
    if (mg.phase !== 'question') return err('Ce n’est pas le moment.');
    if (Date.now() < mg.deadline) return err('Le temps n’est pas écoulé.');
    resolve(room);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase !== 'question') return err('Ce n’est pas le moment.');
    resolve(room);
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
    startQuestion(mg);
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const question = mg.questions[Math.min(mg.round, mg.total) - 1];
  const theme = THEMES.find((t) => t.id === question.theme);
  const done = mg.phase === 'result' || mg.phase === 'end';
  return {
    phase: mg.phase,
    round: mg.round,
    total: mg.total,
    theme: theme ? { label: theme.label, emoji: theme.emoji } : null,
    q: question.q,
    choices: question.choices,
    deadline: mg.phase === 'question' ? mg.deadline : null,
    serverNow: Date.now(),
    seconds: SECONDS,
    answered: Object.keys(mg.answers), // on sait QUI a répondu, jamais QUOI avant la révélation
    myChoice: mg.answers[playerId] ?? null,
    result: done ? mg.result : null,
    ranking: Object.entries(mg.scores)
      .map(([id, points]) => ({ id, points }))
      .sort((a, b) => b.points - a.points),
  };
}

module.exports = { meta, init, act, view, themeCount, buildQuestions };
