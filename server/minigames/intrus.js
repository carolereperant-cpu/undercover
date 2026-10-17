'use strict';

/**
 * L'intrus (type Spyfall) : tous connaissent le lieu, sauf l'espion. On se pose des questions à voix haute
 * pour le démasquer sans révéler le lieu. L'espion peut tenter de deviner le lieu à tout moment.
 */

const { ok, err, pick } = require('../common');
const { LOCATIONS } = require('./content');

const meta = {
  id: 'intrus',
  label: 'L’intrus',
  emoji: '🕵️',
  tagline: 'Tout le monde connaît le lieu, sauf un espion.',
  min: 3,
  max: 13,
  minutes: '8 à 10',
  maxMinutes: 10,
  rules: [
    'Tous les joueurs voient le même lieu secret, sauf l’espion.',
    'À tour de rôle, posez-vous des questions à voix haute sur le lieu, sans le nommer.',
    'À tout moment, l’espion peut tenter de deviner le lieu : s’il se trompe, il perd.',
    'Quand vous soupçonnez quelqu’un, l’hôte ouvre le vote. Si l’espion est démasqué, il a une dernière chance de deviner le lieu.',
  ],
};

function init(room) {
  const spy = pick(room.players);
  room.mg = {
    location: pick(LOCATIONS),
    spyId: spy.id,
    firstId: pick(room.players).id,
    phase: 'play',
    startedAt: Date.now(),
    durationMs: 8 * 60_000,
    votes: {},
    accusedId: null,
    notice: null,
    winner: null,
    reason: null,
    guessed: null,
  };
}

function finish(room, winner, reason) {
  const mg = room.mg;
  mg.phase = 'end';
  mg.winner = winner;
  mg.reason = reason;
  room.phase = 'end';
}

function resolveVote(room) {
  const mg = room.mg;
  const counts = {};
  for (const target of Object.values(mg.votes)) counts[target] = (counts[target] ?? 0) + 1;
  const max = Math.max(...Object.values(counts));
  const top = Object.keys(counts).filter((id) => counts[id] === max);
  if (top.length > 1) {
    mg.votes = {};
    mg.phase = 'play';
    mg.notice = 'Égalité : personne n’est accusé. Continuez à poser des questions.';
    return;
  }
  mg.accusedId = top[0];
  mg.votes = {};
  if (mg.accusedId === mg.spyId) {
    mg.phase = 'spyGuess';
    mg.notice = null;
  } else {
    finish(room, 'spy', 'innocent');
  }
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');

  if (type === 'spyGuess') {
    if (actor.id !== mg.spyId) return err('Seul l’espion peut deviner le lieu.');
    if (mg.phase !== 'play' && mg.phase !== 'spyGuess') return err('Ce n’est pas le moment.');
    if (!LOCATIONS.includes(payload.location)) return err('Lieu invalide.');
    mg.guessed = payload.location;
    if (payload.location === mg.location) {
      finish(room, 'spy', mg.phase === 'spyGuess' ? 'spy-found-place-after-caught' : 'spy-found-place');
    } else {
      finish(room, 'civils', mg.phase === 'spyGuess' ? 'spy-caught' : 'spy-wrong-guess');
    }
    return ok();
  }

  if (type === 'vote') {
    if (mg.phase !== 'vote') return err('Le vote n’est pas ouvert.');
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target) return err('Joueur introuvable.');
    if (target.id === actor.id) return err('Tu ne peux pas voter pour toi.');
    mg.votes[actor.id] = target.id;
    if (room.players.every((p) => mg.votes[p.id])) resolveVote(room);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'openVote') {
    if (mg.phase !== 'play') return err('Ce n’est pas le moment.');
    mg.phase = 'vote';
    mg.votes = {};
    mg.notice = null;
    return ok();
  }

  if (type === 'giveUp') {
    // Si l'espion démasqué ne répond pas (téléphone éteint…), l'hôte peut conclure la partie.
    if (mg.phase !== 'spyGuess') return err('Ce n’est pas le moment.');
    finish(room, 'civils', 'spy-caught');
    return ok();
  }

  if (type === 'closeVote') {
    if (mg.phase !== 'vote') return err('Ce n’est pas le moment.');
    if (Object.keys(mg.votes).length === 0) return err('Personne n’a encore voté.');
    resolveVote(room);
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const isSpy = playerId === mg.spyId;
  const over = mg.phase === 'end';
  return {
    phase: mg.phase,
    isSpy,
    location: isSpy && !over ? null : mg.location,
    locations: LOCATIONS,
    firstId: mg.firstId,
    startedAt: mg.startedAt,
    durationMs: mg.durationMs,
    voted: Object.keys(mg.votes),
    myVote: mg.votes[playerId] ?? null,
    accusedId: mg.accusedId,
    notice: mg.notice,
    // Le nom de l'espion n'est révélé qu'à la fin (ou quand il est démasqué).
    spyId: over || mg.phase === 'spyGuess' ? mg.spyId : null,
    winner: mg.winner,
    reason: mg.reason,
    guessed: mg.guessed,
  };
}

module.exports = { meta, init, act, view };
