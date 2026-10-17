'use strict';

/**
 * « Qui est le plus susceptible de… ? » : une question s'affiche, chacun vote pour un joueur.
 * 8 questions, puis le classement des « titres » gagnés.
 */

const { ok, err, shuffle } = require('../common');
const { QUESTIONS } = require('./content');

const ROUNDS = 8;

const meta = {
  id: 'susceptible',
  label: 'Qui est le plus susceptible de…',
  emoji: '🗳️',
  tagline: 'Une question rigolote, tout le monde vote pour un joueur.',
  min: 3,
  max: 13,
  minutes: '10',
  maxMinutes: 10,
  rules: [
    'Une question « Qui est le plus susceptible de… » s’affiche.',
    'Chacun vote en secret pour un joueur (pas pour soi).',
    'Le résultat est révélé : le plus voté gagne le titre. 8 questions par partie.',
  ],
};

const aliveIds = (room) => room.players.map((p) => p.id);

function init(room) {
  room.mg = {
    round: 1,
    total: ROUNDS,
    questions: shuffle(QUESTIONS).slice(0, ROUNDS),
    phase: 'vote',
    votes: {},
    result: null,
    totals: Object.fromEntries(aliveIds(room).map((id) => [id, 0])),
  };
}

function resolve(room) {
  const mg = room.mg;
  const counts = Object.fromEntries(aliveIds(room).map((id) => [id, 0]));
  for (const target of Object.values(mg.votes)) if (target in counts) counts[target] += 1;
  const max = Math.max(...Object.values(counts));
  const winners = Object.keys(counts).filter((id) => counts[id] === max && max > 0);
  for (const id of winners) mg.totals[id] += 1; // un titre par manche gagnée (les ex æquo en gagnent un chacun)
  mg.result = { counts, winners, max };
  mg.phase = 'result';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');

  if (type === 'vote') {
    if (mg.phase !== 'vote') return err('Ce n’est pas le moment de voter.');
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target) return err('Joueur introuvable.');
    if (target.id === actor.id) return err('Tu ne peux pas voter pour toi.');
    mg.votes[actor.id] = target.id;
    if (aliveIds(room).every((id) => mg.votes[id])) resolve(room);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase !== 'vote') return err('Ce n’est pas le moment.');
    if (Object.keys(mg.votes).length === 0) return err('Personne n’a encore voté.');
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
    mg.votes = {};
    mg.result = null;
    mg.phase = 'vote';
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const ranking = Object.entries(mg.totals)
    .map(([id, titles]) => ({ id, titles }))
    .sort((a, b) => b.titles - a.titles);
  return {
    phase: mg.phase,
    round: mg.round,
    total: mg.total,
    question: mg.questions[mg.round - 1],
    voted: Object.keys(mg.votes),
    myVote: mg.votes[playerId] ?? null,
    result: mg.phase === 'vote' ? null : mg.result,
    ranking,
  };
}

module.exports = { meta, init, act, view };
